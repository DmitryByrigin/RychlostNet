/**
 * SimpleSpeedTest - упрощенная реализация теста скорости LibreSpeed
 * Основана на официальной реализации, но с улучшениями для надежности
 * и уменьшенной сложностью для лучшей отладки
 * 
 * Источник: https://github.com/librespeed/speedtest
 */

// Состояния теста
export enum TestState {
  WAITING = 0,  // ожидание запуска
  PING = 1,     // выполняется тест пинга
  DOWNLOAD = 2, // выполняется тест загрузки
  UPLOAD = 3,   // выполняется тест выгрузки
  FINISHED = 4, // тест завершен
  ABORTED = 5   // тест прерван
}

// Тип данных для обновления результатов
export interface SpeedTestProgress {
  pingStatus: string;
  jitterStatus: string;
  dlStatus: string;
  ulStatus: string;
  pingProgress?: number;
  dlProgress?: number;
  ulProgress?: number;
  testState: TestState;
}

// Тип данных для конфигурации теста
export interface SpeedTestSettings {
  // URL адреса для тестирования
  url_dl: string;
  url_ul: string;
  url_ping: string;
  url_getIp?: string;
  
  // Настройки теста
  test_order?: string;      // Порядок выполнения тестов: P_D_U (ping, download, upload)
  time_dl_max?: number;     // Максимальное время теста загрузки в секундах
  time_ul_max?: number;     // Максимальное время теста выгрузки в секундах
  time_auto?: boolean;      // Автоматическая адаптация времени теста
  count_ping?: number;      // Количество измерений пинга
  xhr_dlMultistream?: number; // Количество параллельных потоков для загрузки
  xhr_ulMultistream?: number; // Количество параллельных потоков для выгрузки
  xhr_ignoreErrors?: number;  // Игнорировать ошибки XHR
  xhr_dlUseBlob?: boolean;    // Использовать Blob для загрузки
  xhr_ul_blob_megabytes?: number; // Размер блоба в МБ для теста выгрузки
  garbagePhp_chunkSize?: number;  // Размер чанка для garbage.php
  mpot?: boolean;           // Отключение множественных тестовых точек
  overheadCompensationFactor?: number; // Фактор компенсации накладных расходов
  useMebibits?: boolean;    // Использовать Mebibits вместо Megabits
  accuracy?: number;        // Точность измерения (0-8), выше = точнее, но дольше
  download_bias?: number;   // Поправочный коэффициент для загрузки (0.8-1.5)
  upload_bias?: number;     // Поправочный коэффициент для выгрузки (0.8-1.5)
  ping_bias?: number;       // Поправочный коэффициент для пинга (0.8-1.5)
}

export class SimpleSpeedTest {
  private state: TestState = TestState.WAITING;
  private settings: SpeedTestSettings;
  private defaultSettings: SpeedTestSettings = {
    test_order: "P_D_U",
    time_dl_max: 10,
    time_ul_max: 10, // Уменьшаем максимальное время выгрузки с 300 до 10 секунд
    time_auto: true,
    count_ping: 20, // Увеличиваем количество измерений пинга для большей точности
    xhr_dlMultistream: 6, // Увеличиваем с 3 до 6 для повышения точности
    xhr_ulMultistream: 6, // Увеличиваем с 3 до 6 для повышения точности
    xhr_ignoreErrors: 1,
    xhr_dlUseBlob: false,
    xhr_ul_blob_megabytes: 20,
    garbagePhp_chunkSize: 100,
    mpot: false,
    overheadCompensationFactor: 1.06,
    useMebibits: false,
    url_dl: "",
    url_ul: "",
    url_ping: "",
    url_getIp: "",
    accuracy: 3, // Средняя точность по умолчанию
    download_bias: 1.0, // Нет смещения по умолчанию
    upload_bias: 1.0, // Нет смещения по умолчанию
    ping_bias: 1.0 // Нет смещения по умолчанию
  };
  
  // Результаты теста
  private results = {
    ping: 0,
    jitter: 0,
    download: 0,
    upload: 0,
    ip: "",
    testTime: new Date()
  };
  
  // Прогресс теста
  private progress = {
    pingProgress: 0,
    dlProgress: 0,
    ulProgress: 0
  };
  
  // Добавляем счетчик запросов выгрузки и максимальное количество
  private uploadCount = 0;
  private maxUploadRequests = 20; // Увеличиваем с 15 до 20 для повышения точности
  
  // Обработчики событий
  public onupdate: ((data: SpeedTestProgress) => void) | null = null;
  public onend: ((aborted: boolean) => void) | null = null;
  
  // Переменные для тестов и кеширования
  private worker = navigator.hardwareConcurrency || 4;
  private dlStatus = "";
  private ulStatus = "";
  private pingStatus = "";
  private jitterStatus = "";
  private dlProgress = 0;
  private ulProgress = 0;
  private pingProgress = 0;
  
  // Технические переменные
  private xhrRequest: XMLHttpRequest[] = [];
  private interval: NodeJS.Timeout | null = null;
  private downloadTestTimer: NodeJS.Timeout | null = null;
  private uploadTestTimer: NodeJS.Timeout | null = null;
  private pendingRequests = 0;
  private startTime = 0;
  private prevTime = 0;
  private prevLoaded = 0;
  private totalBytes = 0;
  private pingRuns = 0;
  private prevPingProgress = 0;
  private isRunning = false;
  private pingValues: number[] = [];
  private jitterValues: number[] = [];
  
  // Переменные для отслеживания стабилизации результатов
  private lastDlSpeed = 0;
  private lastDlSpeedChangeTime = 0;
  private lastUlSpeed = 0;
  private lastUlSpeedChangeTime = 0;
  private stableSpeedThreshold = 0.05; // Уменьшаем порог с 10% до 5% для большей точности
  private minStableTime = 2; // минимальное время стабильной скорости в секундах
  
  // Отслеживание выполненных тестов
  private completedTests: { [key: string]: boolean } = {
    P: false, // Пинг
    D: false, // Загрузка
    U: false  // Выгрузка
  };
  
  /**
   * Конструктор принимает настройки для теста скорости
   */
  constructor(settings: Partial<SpeedTestSettings>) {
    this.settings = { ...this.defaultSettings, ...settings };
    
    // Проверка обязательных параметров
    if (!this.settings.url_dl || !this.settings.url_ul || !this.settings.url_ping) {
      throw new Error("Необходимо указать url_dl, url_ul и url_ping в настройках");
    }
    
    // Устанавливаем параметры в зависимости от точности
    if (this.settings.accuracy !== undefined) {
      const accuracy = Math.min(8, Math.max(1, this.settings.accuracy));
      this.settings.count_ping = 5 + accuracy * 5; // от 10 до 45 пингов
      this.settings.xhr_dlMultistream = 3 + accuracy; // от 4 до 11 потоков
      this.settings.xhr_ulMultistream = 3 + accuracy; // от 4 до 11 потоков
      this.maxUploadRequests = 10 + accuracy * 2; // от 12 до 26 запросов
      this.stableSpeedThreshold = 0.1 - (accuracy * 0.01); // от 0.09 до 0.02
    }
  }
  
  /**
   * Устанавливает параметр теста
   */
  public setParameter(name: keyof SpeedTestSettings, value: any): void {
    if (this.state !== TestState.WAITING) {
      throw new Error("Нельзя изменять параметры во время теста");
    }
    (this.settings as any)[name] = value;
  }
  
  /**
   * Возвращает текущее состояние теста
   */
  public getState(): TestState {
    return this.state;
  }
  
  /**
   * Возвращает результаты теста
   */
  public getResults(): any {
    return this.results;
  }
  
  /**
   * Запускает тест скорости согласно настройкам
   */
  public start(): void {
    if (this.state !== TestState.WAITING) {
      throw new Error("Тест уже запущен или завершен");
    }
    
    // Сброс значений
    this.isRunning = true;
    this.dlStatus = "";
    this.ulStatus = "";
    this.pingStatus = "";
    this.jitterStatus = "";
    this.dlProgress = 0;
    this.ulProgress = 0;
    this.pingProgress = 0;
    this.pingValues = [];
    this.jitterValues = [];
    
    // Сбрасываем отслеживание выполненных тестов
    this.completedTests = {
      P: false,
      D: false,
      U: false
    };
    
    // Запускаем тесты в порядке, указанном в настройках
    const testOrder = this.settings.test_order || "P_D_U";
    
    console.log(`🚀 Запуск SimpleSpeedTest, порядок тестов: ${testOrder}`);
    
    // Запуск первого теста
    if (testOrder.indexOf("P") !== -1) {
      this.startPingTest();
    } else if (testOrder.indexOf("D") !== -1) {
      this.startDownloadTest();
    } else if (testOrder.indexOf("U") !== -1) {
      this.startUploadTest();
    } else {
      this.endTest(false);
    }
  }
  
  /**
   * Прерывает текущий тест
   */
  public abort(): void {
    if (this.state === TestState.WAITING || this.state === TestState.FINISHED || this.state === TestState.ABORTED) {
      return;
    }
    
    console.log("⚠️ Тест прерван пользователем");
    this.abortRequests();
    this.clearAllTimers();
    this.state = TestState.ABORTED;
    this.isRunning = false;
    
    if (this.onend) this.onend(true);
  }
  
  /**
   * Завершает текущий тест
   */
  private endTest(aborted: boolean): void {
    if (this.state === TestState.FINISHED || this.state === TestState.ABORTED) return;
    
    console.log("✅ Тест завершен");
    console.log(`📊 Итоговые результаты: 
      - Пинг: ${this.results.ping.toFixed(2)} мс
      - Джиттер: ${this.results.jitter.toFixed(2)} мс
      - Загрузка: ${this.results.download.toFixed(2)} Мбит/с
      - Выгрузка: ${this.results.upload.toFixed(2)} Мбит/с`);
    
    this.abortRequests();
    this.clearAllTimers();
    this.state = aborted ? TestState.ABORTED : TestState.FINISHED;
    this.isRunning = false;
    
    this.results.testTime = new Date();
    
    if (this.onend) this.onend(aborted);
  }
  
  /**
   * Прерывает все текущие сетевые запросы
   */
  private abortRequests(): void {
    this.xhrRequest.forEach(xhr => {
      if (xhr) {
        try {
          xhr.onprogress = null;
          xhr.onload = null;
          xhr.onerror = null;
          xhr.abort();
        } catch (e) {
          // Игнорируем ошибки при отмене запросов
        }
      }
    });
    this.xhrRequest = [];
    this.pendingRequests = 0;
  }
  
  /**
   * Отправляет обновление статуса клиенту
   */
  private sendUpdate(): void {
    if (!this.onupdate) return;
    
    this.onupdate({
      pingStatus: this.pingStatus,
      jitterStatus: this.jitterStatus,
      dlStatus: this.dlStatus,
      ulStatus: this.ulStatus,
      pingProgress: this.pingProgress,
      dlProgress: this.dlProgress,
      ulProgress: this.ulProgress,
      testState: this.state
    });
  }
  
  /**
   * Запускает тест пинга
   */
  private startPingTest(): void {
    this.state = TestState.PING;
    this.pingRuns = 0;
    this.pingProgress = 0;
    
    console.log("🏓 Запуск теста пинга");
    
    // Запускаем мониторинг прогресса
    this.interval = setInterval(() => {
      this.sendUpdate();
    }, 200);
    
    // Запускаем тест пинга
    this.doPing();
  }
  
  /**
   * Выполняет один запрос пинга
   */
  private doPing(): void {
    if (!this.isRunning) return;
    
    // Увеличиваем счетчик запусков
    this.pingRuns++;
    
    // Сохраняем время старта
    this.prevTime = Date.now();
    
    // Создаем запрос
    const xhr = new XMLHttpRequest();
    this.xhrRequest.push(xhr);
    
    // Добавляем случайный параметр для предотвращения кеширования
    const pingUrl = `${this.settings.url_ping}${this.settings.url_ping.indexOf("?") === -1 ? "?" : "&"}_=${Date.now()}`;
    
    xhr.open("GET", pingUrl, true);
    xhr.responseType = "text";
    
    // Обработчик успешного завершения
    xhr.onload = () => {
      if (!this.isRunning) return;
      
      // Рассчитываем пинг
      const pingTime = Date.now() - this.prevTime;
      
      // Добавляем в массив для расчета среднего и джиттера
      this.pingValues.push(pingTime);
      
      // Расчет джиттера (разброса пинга)
      if (this.pingValues.length > 1) {
        this.jitterValues.push(Math.abs(this.pingValues[this.pingValues.length - 1] - this.pingValues[this.pingValues.length - 2]));
      }
      
      // Обновляем статус
      // Используем только 75% лучших результатов для расчета среднего пинга
      const sortedPings = [...this.pingValues].sort((a, b) => a - b);
      const bestPings = sortedPings.slice(0, Math.ceil(sortedPings.length * 0.75));
      
      // Среднее значение лучших пингов
      const avgPing = bestPings.length > 0 
        ? bestPings.reduce((a, b) => a + b, 0) / bestPings.length 
        : this.pingValues[0];
      
      // Джиттер - среднее отклонение
      let jitterSum = 0;
      if (this.jitterValues.length > 0) {
        jitterSum = this.jitterValues.reduce((a, b) => a + b, 0);
      }
      const jitterAvg = this.jitterValues.length > 0 ? jitterSum / this.jitterValues.length : 0;
      
      // Применяем поправочный коэффициент к пингу и джиттеру
      const adjustedPing = avgPing * (this.settings.ping_bias || 1.0);
      const adjustedJitter = jitterAvg * (this.settings.ping_bias || 1.0);
      
      this.pingStatus = adjustedPing.toFixed(2);
      this.jitterStatus = adjustedJitter.toFixed(2);
      this.results.ping = adjustedPing;
      this.results.jitter = adjustedJitter;
      
      // Обновляем прогресс
      this.pingProgress = this.pingRuns / this.settings.count_ping!;
      
      // Если достигли нужного количества измерений, заканчиваем тест пинга
      if (this.pingRuns >= this.settings.count_ping!) {
        this.pingProgress = 1;
        
        console.log(`🏓 Тест пинга завершен: ${this.pingStatus}ms, джиттер: ${this.jitterStatus}ms`);
        
        // Отмечаем тест пинга как выполненный
        this.completedTests.P = true;
        
        // Переходим к следующему тесту
        this.goToNextTest("P");
        return;
      }
      
      // Продолжаем тест с новым запросом
      setTimeout(() => this.doPing(), 200); // Уменьшаем интервал с 500 до 200 мс для ускорения
    };
    
    // Обработчик ошибки
    xhr.onerror = () => {
      if (!this.isRunning) return;
      
      console.error("❌ Ошибка при тесте пинга");
      
      // Прерываем текущий запрос
      xhr.abort();
      this.xhrRequest = this.xhrRequest.filter(x => x !== xhr);
      
      // Если есть игнорирование ошибок, пробуем еще раз
      if (this.settings.xhr_ignoreErrors) {
        setTimeout(() => this.doPing(), 100);
      } else {
        this.endTest(true);
      }
    };
    
    // Добавляем таймаут для запроса пинга
    xhr.timeout = 5000; // 5 секунд максимум
    xhr.ontimeout = () => {
      console.warn("⚠️ Таймаут запроса пинга");
      xhr.abort();
      this.xhrRequest = this.xhrRequest.filter(x => x !== xhr);
      
      // Пробуем еще раз
      if (this.settings.xhr_ignoreErrors) {
        setTimeout(() => this.doPing(), 100);
      }
    };
    
    // Отправляем запрос
    xhr.send();
  }
  
  /**
   * Переход к следующему тесту в последовательности
   */
  private goToNextTest(currentTest: string): void {
    const testOrder = this.settings.test_order || "P_D_U";
    console.log(`🔄 Выбор следующего теста после ${currentTest}. Порядок: ${testOrder}, выполнены: P=${this.completedTests.P}, D=${this.completedTests.D}, U=${this.completedTests.U}`);
    
    // Проверяем, все ли тесты выполнены
    if (
      (testOrder.includes("P") && !this.completedTests.P) ||
      (testOrder.includes("D") && !this.completedTests.D) ||
      (testOrder.includes("U") && !this.completedTests.U)
    ) {
      // Если есть невыполненные тесты, выбираем следующий
      if (testOrder.includes("D") && !this.completedTests.D) {
        console.log("📊 Запуск теста загрузки (D) как следующего в очереди");
        this.startDownloadTest();
      } else if (testOrder.includes("U") && !this.completedTests.U) {
        console.log("📊 Запуск теста выгрузки (U) как следующего в очереди");
        this.startUploadTest();
      } else if (testOrder.includes("P") && !this.completedTests.P) {
        console.log("📊 Запуск теста пинга (P) как следующего в очереди");
        this.startPingTest();
      }
    } else {
      // Все тесты выполнены, завершаем
      console.log("✅ Все тесты в последовательности выполнены");
      this.endTest(false);
    }
  }
  
  /**
   * Запускает тест скорости загрузки
   */
  private startDownloadTest(): void {
    // Если тест загрузки уже выполнен, переходим к следующему тесту
    if (this.completedTests.D) {
      console.log("⚠️ Тест загрузки уже выполнен, пропускаем");
      this.goToNextTest("D");
      return;
    }
    
    // Очищаем таймер выгрузки, если он есть
    if (this.uploadTestTimer) {
      clearTimeout(this.uploadTestTimer);
      this.uploadTestTimer = null;
    }
    
    this.state = TestState.DOWNLOAD;
    this.dlProgress = 0;
    this.dlStatus = "0.00";
    
    // Сбрасываем переменные стабилизации
    this.lastDlSpeed = 0;
    this.lastDlSpeedChangeTime = 0;
    
    console.log("⬇️ Запуск теста загрузки");
    console.log(`🔍 URL для загрузки: ${this.settings.url_dl}`);
    
    // Запускаем мониторинг прогресса
    if (!this.interval) {
      this.interval = setInterval(() => {
        this.sendUpdate();
      }, 200);
    }
    
    // Сброс счетчиков
    this.totalBytes = 0;
    this.startTime = Date.now();
    this.prevLoaded = 0;
    this.prevTime = Date.now();
    
    // Предварительный запрос для прогрева соединения
    this.doPreconnect(this.settings.url_dl);
    
    // Запускаем несколько параллельных потоков загрузки
    this.pendingRequests = 0;
    for (let i = 0; i < this.settings.xhr_dlMultistream!; i++) {
      this.pendingRequests++;
      this.doDownloadRequest();
    }
    
    // Запускаем таймер для завершения теста
    this.downloadTestTimer = setTimeout(() => {
      this.completeDownloadTest();
    }, this.settings.time_dl_max! * 1000);
  }
  
  /**
   * Выполняет предварительное соединение с сервером для уменьшения задержки первого запроса
   */
  private doPreconnect(url: string): void {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = url;
    document.head.appendChild(link);
    
    setTimeout(() => {
      document.head.removeChild(link);
    }, 5000);
  }
  
  /**
   * Выполняет один запрос загрузки данных
   */
  private doDownloadRequest(): void {
    if (!this.isRunning) return;
    
    // Создаем запрос
    const xhr = new XMLHttpRequest();
    this.xhrRequest.push(xhr);
    
    // Используем Blob если это указано в настройках
    xhr.responseType = this.settings.xhr_dlUseBlob ? "blob" : "arraybuffer";
    
    // Добавляем случайный параметр и размер для предотвращения кеширования
    const chunkSize = this.settings.garbagePhp_chunkSize;
    let dlURL = this.settings.url_dl;
    
    // Если URL уже содержит параметры, добавляем через &, иначе через ?
    if (dlURL.indexOf("?") === -1) {
      dlURL += "?";
    } else {
      dlURL += "&";
    }
    
    // Добавляем параметры
    dlURL += "ckSize=" + chunkSize;
    dlURL += "&_=" + Date.now();
    
    // Начинаем загрузку
    try {
      xhr.open("GET", dlURL, true);
      
      // Устанавливаем заголовки для предотвращения кеширования
      xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      xhr.setRequestHeader('Pragma', 'no-cache');
      xhr.setRequestHeader('Expires', '0');
      
      // Обработчик прогресса
      xhr.onprogress = (event) => {
        if (!this.isRunning) return;
        
        // Обновляем счетчики загруженных данных
        const loaded = event.loaded;
        const now = Date.now();
        
        // Добавляем к общему счетчику загрузки
        if (loaded > this.prevLoaded) {
          this.totalBytes += loaded - this.prevLoaded;
        }
        
        this.prevLoaded = loaded;
        this.prevTime = now;
        
        // Рассчитываем скорость загрузки
        const timeElapsed = (now - this.startTime) / 1000; // в секундах
        
        if (timeElapsed > 0) {
          // Вычисляем скорость в мегабитах в секунду
          const speed = (this.totalBytes * 8) / (1024 * 1024 * timeElapsed);
          
          // Применяем поправочный коэффициент
          const adjustedSpeed = speed * (this.settings.download_bias || 1.0);
          
          // Устанавливаем статус
          this.dlStatus = adjustedSpeed.toFixed(2);
          this.results.download = adjustedSpeed;
          
          // Проверяем стабилизацию скорости
          const speedChange = Math.abs(adjustedSpeed - this.lastDlSpeed) / this.lastDlSpeed;
          
          if (this.lastDlSpeed > 0 && speedChange < this.stableSpeedThreshold) {
            // Если скорость стабилизировалась
            if (this.lastDlSpeedChangeTime === 0) {
              this.lastDlSpeedChangeTime = now;
            } else if ((now - this.lastDlSpeedChangeTime) / 1000 > this.minStableTime) {
              // Если скорость стабильна достаточно долго, завершаем тест
              clearTimeout(this.downloadTestTimer!);
              this.downloadTestTimer = null;
              this.completeDownloadTest();
              return;
            }
          } else {
            // Если скорость изменилась, сбрасываем таймер стабилизации
            this.lastDlSpeed = adjustedSpeed;
            this.lastDlSpeedChangeTime = 0;
          }
          
          // Обновляем прогресс
          const timeFraction = Math.min(1, timeElapsed / this.settings.time_dl_max!);
          this.dlProgress = timeFraction;
        }
      };
      
      // Обработчик завершения
      xhr.onload = () => {
        if (!this.isRunning) return;
        
        // Создаем новый запрос
        this.pendingRequests--;
        this.doDownloadRequest();
      };
      
      // Обработчик ошибки
      xhr.onerror = () => {
        if (!this.isRunning) return;
        
        // Завершаем текущий запрос
        xhr.abort();
        this.xhrRequest = this.xhrRequest.filter(x => x !== xhr);
        
        this.pendingRequests--;
        
        // Если игнорируем ошибки, пробуем еще раз
        if (this.settings.xhr_ignoreErrors) {
          setTimeout(() => this.doDownloadRequest(), 100);
        } else if (this.pendingRequests === 0) {
          // Если все запросы завершились с ошибкой, завершаем тест
          this.completeDownloadTest();
        }
      };
      
      // Добавляем таймаут для запроса
      xhr.timeout = 10000; // 10 секунд максимум
      xhr.ontimeout = () => {
        console.warn("⚠️ Таймаут запроса загрузки");
        xhr.abort();
        this.xhrRequest = this.xhrRequest.filter(x => x !== xhr);
        
        this.pendingRequests--;
        
        // Пробуем еще раз
        if (this.settings.xhr_ignoreErrors) {
          setTimeout(() => this.doDownloadRequest(), 100);
        } else if (this.pendingRequests === 0) {
          this.completeDownloadTest();
        }
      };
      
      // Отправляем запрос
      xhr.send();
    } catch (e) {
      console.error("❌ Ошибка при создании запроса загрузки:", e);
      this.pendingRequests--;
      
      if (this.pendingRequests === 0) {
        this.completeDownloadTest();
      }
    }
  }
  
  /**
   * Завершает тест загрузки
   */
  private completeDownloadTest(): void {
    // Очищаем таймер загрузки
    if (this.downloadTestTimer) {
      clearTimeout(this.downloadTestTimer);
      this.downloadTestTimer = null;
    }
    
    // Останавливаем все запросы
    this.abortRequests();
    
    // Устанавливаем прогресс загрузки в 100%
    this.dlProgress = 1;
    
    console.log(`⬇️ Тест загрузки завершен: ${this.dlStatus} Мбит/с`);
    
    // Отмечаем тест загрузки как выполненный
    this.completedTests.D = true;
    
    // Переходим к следующему тесту
    this.goToNextTest("D");
  }
  
  /**
   * Запускает тест скорости выгрузки
   */
  private startUploadTest(): void {
    // Если тест выгрузки уже выполнен, переходим к следующему тесту
    if (this.completedTests.U) {
      console.log("⚠️ Тест выгрузки уже выполнен, пропускаем");
      this.goToNextTest("U");
      return;
    }
    
    // Очищаем таймеры
    if (this.downloadTestTimer) {
      clearTimeout(this.downloadTestTimer);
      this.downloadTestTimer = null;
    }
    
    this.state = TestState.UPLOAD;
    this.ulProgress = 0;
    this.ulStatus = "0.00";
    this.uploadCount =  0;
    
    // Сбрасываем переменные стабилизации
    this.lastUlSpeed = 0;
    this.lastUlSpeedChangeTime = 0;
    
    console.log("⬆️ Запуск теста выгрузки");
    console.log(`🔍 URL для выгрузки: ${this.settings.url_ul}`);
    
    // Запускаем мониторинг прогресса
    if (!this.interval) {
      this.interval = setInterval(() => {
        this.sendUpdate();
      }, 200);
    }
    
    // Сброс счетчиков
    this.totalBytes = 0;
    this.startTime = Date.now();
    this.prevLoaded = 0;
    this.prevTime = Date.now();
    
    // Предварительный запрос для прогрева соединения
    this.doPreconnect(this.settings.url_ul);
    
    // Запускаем несколько параллельных потоков выгрузки
    this.pendingRequests = 0;
    for (let i = 0; i < this.settings.xhr_ulMultistream!; i++) {
      this.pendingRequests++;
      this.doUploadRequest();
    }
    
    // Запускаем таймер для завершения теста
    this.uploadTestTimer = setTimeout(() => {
      this.completeUploadTest();
    }, this.settings.time_ul_max! * 1000);
  }
  
  /**
   * Завершает тест выгрузки
   */
  private completeUploadTest(): void {
    // Очищаем таймер выгрузки
    if (this.uploadTestTimer) {
      clearTimeout(this.uploadTestTimer);
      this.uploadTestTimer = null;
    }
    
    // Останавливаем все запросы
    this.abortRequests();
    
    // Устанавливаем прогресс выгрузки в 100%
    this.ulProgress = 1;
    
    console.log(`⬆️ Тест выгрузки завершен: ${this.ulStatus} Мбит/с`);
    
    // Отмечаем тест выгрузки как выполненный
    this.completedTests.U = true;
    
    // Переходим к следующему тесту
    this.goToNextTest("U");
  }
  
  /**
   * Выполняет один запрос выгрузки данных
   */
  private doUploadRequest(): void {
    if (!this.isRunning) return;
    
    // Проверка количества запросов
    this.uploadCount++;
    if (this.uploadCount >= this.maxUploadRequests) {
      console.log(`⚠️ Достигнуто максимальное количество запросов выгрузки: ${this.maxUploadRequests}`);
      this.pendingRequests--;
      return;
    }
    
    // Создаем запрос
    const xhr = new XMLHttpRequest();
    this.xhrRequest.push(xhr);
    
    // Генерируем данные для отправки
    // Размер блоба в байтах (указано в МБ в настройках)
    const size = this.settings.xhr_ul_blob_megabytes! * 1024 * 1024;
    
    let blobData;
    
    try {
      // Используем Uint8Array для создания случайных данных - это более эффективно
      const data = new Uint8Array(size);
      
      // Эта оптимизация помогает браузеру быстрее создать блоб
      // Вместо полностью случайных данных, используем повторяющийся паттерн
      const pattern = new Uint8Array(1024);
      for (let i = 0; i < 1024; i++) {
        pattern[i] = Math.random() * 256;
      }
      
      // Копируем паттерн, заполняя весь массив
      for (let i = 0; i < size; i += 1024) {
        const chunkSize = Math.min(1024, size - i);
        data.set(pattern.subarray(0, chunkSize), i);
      }
      
      // Создаем blob для отправки
      blobData = new Blob([data], { type: 'application/octet-stream' });
    } catch (e) {
      console.error("❌ Ошибка при создании данных для выгрузки:", e);
      
      // Создаем строку вместо blob как запасной вариант
      let str = "";
      const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      
      // Создаем строку меньшего размера для сохранения производительности
      const adjSize = Math.min(size, 1024 * 1024); // Максимум 1MB строки
      
      for (let i = 0; i < adjSize; i++) {
        str += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      
      blobData = new Blob([str], { type: 'application/octet-stream' });
    }
    
    // Добавляем случайный параметр для предотвращения кеширования
    let ulURL = this.settings.url_ul;
    if (ulURL.indexOf("?") === -1) {
      ulURL += "?";
    } else {
      ulURL += "&";
    }
    ulURL += "_=" + Date.now();
    
    // Начинаем выгрузку
    try {
      xhr.open("POST", ulURL, true);
      
      // Устанавливаем заголовки
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      xhr.setRequestHeader('Pragma', 'no-cache');
      xhr.setRequestHeader('Expires', '0');
      
      // Обработчик отправки данных
      xhr.upload.onprogress = (event) => {
        if (!this.isRunning) return;
        
        // Обновляем счетчики выгруженных данных
        const loaded = event.loaded;
        const now = Date.now();
        
        // Добавляем к общему счетчику выгрузки
        if (loaded > this.prevLoaded) {
          this.totalBytes += loaded - this.prevLoaded;
        }
        
        this.prevLoaded = loaded;
        this.prevTime = now;
        
        // Рассчитываем скорость выгрузки
        const timeElapsed = (now - this.startTime) / 1000; // в секундах
        
        if (timeElapsed > 0) {
          // Вычисляем скорость в мегабитах в секунду
          const speed = (this.totalBytes * 8) / (1024 * 1024 * timeElapsed);
          
          // Применяем поправочный коэффициент
          const adjustedSpeed = speed * (this.settings.upload_bias || 1.0);
          
          // Устанавливаем статус
          this.ulStatus = adjustedSpeed.toFixed(2);
          this.results.upload = adjustedSpeed;
          
          // Проверяем стабилизацию скорости
          const speedChange = Math.abs(adjustedSpeed - this.lastUlSpeed) / this.lastUlSpeed;
          
          if (this.lastUlSpeed > 0 && speedChange < this.stableSpeedThreshold) {
            // Если скорость стабилизировалась
            if (this.lastUlSpeedChangeTime === 0) {
              this.lastUlSpeedChangeTime = now;
            } else if ((now - this.lastUlSpeedChangeTime) / 1000 > this.minStableTime) {
              // Если скорость стабильна достаточно долго, завершаем тест
              clearTimeout(this.uploadTestTimer!);
              this.uploadTestTimer = null;
              this.completeUploadTest();
              return;
            }
          } else {
            // Если скорость изменилась, сбрасываем таймер стабилизации
            this.lastUlSpeed = adjustedSpeed;
            this.lastUlSpeedChangeTime = 0;
          }
          
          // Обновляем прогресс
          const timeFraction = Math.min(1, timeElapsed / this.settings.time_ul_max!);
          this.ulProgress = timeFraction;
        }
      };
      
      // Обработчик завершения
      xhr.onload = () => {
        if (!this.isRunning) return;
        
        // Сбрасываем размер загруженных данных
        this.prevLoaded = 0;
        
        // Создаем новый запрос
        this.pendingRequests--;
        this.doUploadRequest();
      };
      
      // Обработчик ошибки
      xhr.onerror = () => {
        if (!this.isRunning) return;
        
        // Завершаем текущий запрос
        xhr.abort();
        this.xhrRequest = this.xhrRequest.filter(x => x !== xhr);
        
        this.pendingRequests--;
        
        // Если игнорируем ошибки, пробуем еще раз
        if (this.settings.xhr_ignoreErrors) {
          setTimeout(() => this.doUploadRequest(), 100);
        } else if (this.pendingRequests === 0) {
          // Если все запросы завершились с ошибкой, завершаем тест
          this.completeUploadTest();
        }
      };
      
      // Добавляем таймаут для запроса
      xhr.timeout = 12000; // 12 секунд максимум - upload обычно требует больше времени
      xhr.ontimeout = () => {
        console.warn("⚠️ Таймаут запроса выгрузки");
        xhr.abort();
        this.xhrRequest = this.xhrRequest.filter(x => x !== xhr);
        
        this.pendingRequests--;
        
        // Пробуем еще раз
        if (this.settings.xhr_ignoreErrors) {
          setTimeout(() => this.doUploadRequest(), 100);
        } else if (this.pendingRequests === 0) {
          this.completeUploadTest();
        }
      };
      
      // Отправляем запрос
      xhr.send(blobData);
    } catch (e) {
      console.error("❌ Ошибка при создании запроса выгрузки:", e);
      this.pendingRequests--;
      
      if (this.pendingRequests === 0) {
        this.completeUploadTest();
      }
    }
  }
  
  /**
   * Очищает все таймеры
   */
  private clearAllTimers(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    if (this.downloadTestTimer) {
      clearTimeout(this.downloadTestTimer);
      this.downloadTestTimer = null;
    }
    
    if (this.uploadTestTimer) {
      clearTimeout(this.uploadTestTimer);
      this.uploadTestTimer = null;
    }
  }
} 