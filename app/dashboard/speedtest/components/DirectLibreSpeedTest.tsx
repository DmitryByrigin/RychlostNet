import { useEffect, useState, useRef, useCallback } from "react";
import {
  Card,
  Button,
  Table,
  Text,
  Group,
  Select,
  Progress,
  Stack,
  Alert,
  Code,
  Badge,
} from "@mantine/core";
import { LibreSpeedServer } from "../types/librespeed";
import {
  SimpleSpeedTest,
  TestState,
  SpeedTestProgress,
} from "../lib/SimpleSpeedTest"; // Импортируем нашу новую реализацию

// Интерфейс ответа с сервера Nest.js
interface NestServerResponse {
  success: boolean;
  servers: LibreSpeedServer[];
}

// Интерфейс для сервера с метаданными
interface ServerWithMeta extends LibreSpeedServer {
  available?: boolean;
  checked?: boolean;
  pingResult?: number; // результат пинга в мс для сортировки серверов
}

/**
 * Компонент для прямого тестирования скорости между клиентом и серверами LibreSpeed
 * Использует CORS-прокси для обхода ограничений браузера и серверы с бэкенда Nest.js
 * Теперь с собственной реализацией API LibreSpeed для повышения надежности
 */
export const DirectLibreSpeedTest = () => {
  const [results, setResults] = useState({
    ping: "--",
    jitter: "--",
    download: "--",
    upload: "--",
  });
  const [isRunning, setIsRunning] = useState(false);
  const [testState, setTestState] = useState<TestState>(TestState.WAITING);
  const [servers, setServers] = useState<ServerWithMeta[]>([]);
  const [availableServers, setAvailableServers] = useState<ServerWithMeta[]>(
    []
  );
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [diagnosticInfo, setDiagnosticInfo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingServers, setIsCheckingServers] = useState(false);
  const [checkProgress, setCheckProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const speedtestRef = useRef<SimpleSpeedTest | null>(null);
  const isTestStartedRef = useRef(false);
  const activeServerRef = useRef<ServerWithMeta | null>(null);

  // Учебные серверы (запасные, если API вернет пустой список)
  const fallbackServers: LibreSpeedServer[] = [
    {
      name: "LibreSpeed.org (Франкфурт)",
      server: "librespeed.org",
      dlURL: "garbage.php",
      ulURL: "empty.php",
      pingURL: "empty.php",
      getIpURL: "getIP.php",
      country: "DE",
    },
    {
      name: "LibreSpeed.org (Рим)",
      server: "librespeed.org/backend-it",
      dlURL: "garbage.php",
      ulURL: "empty.php",
      pingURL: "empty.php",
      getIpURL: "getIP.php",
      country: "IT",
    },
    {
      name: "LibreSpeed.org (Нью-Йорк)",
      server: "librespeed.org/backend-nyc",
      dlURL: "garbage.php",
      ulURL: "empty.php",
      pingURL: "empty.php",
      getIpURL: "getIP.php",
      country: "US",
    },
  ];

  // Вспомогательная функция для обработки путей
  const normalizePath = (server: ServerWithMeta, path: string): string => {
    // Если путь уже содержит 'backend/', не добавляем его снова
    if (path.includes("backend/")) {
      return path;
    }

    // Если сервер содержит 'backend' в URL или имени, добавляем 'backend/' к пути
    if (
      server.server.includes("backend") ||
      server.name.toLowerCase().includes("backend")
    ) {
      return `backend/${path}`;
    }

    // Проверяем, есть ли у сервера специфичные URL для dl/ul/ping и используем их пути
    if (path === "garbage.php" && server.dlURL) {
      // Извлекаем путь из dlURL, если он есть
      const dlPath = server.dlURL;
      if (dlPath.includes("/")) {
        return dlPath;
      }
    }

    if (path === "empty.php" && server.ulURL) {
      // Извлекаем путь из ulURL, если он есть
      const ulPath = server.ulURL;
      if (ulPath.includes("/")) {
        return ulPath;
      }
    }

    if (path === "empty.php" && server.pingURL) {
      // Извлекаем путь из pingURL, если он есть
      const pingPath = server.pingURL;
      if (pingPath.includes("/")) {
        return pingPath;
      }
    }

    return path;
  };

  // Функция для проверки доступности сервера с повторными попытками
  const checkServerAvailability = async (
    server: ServerWithMeta,
    retries = 2
  ): Promise<{ available: boolean; pingTime?: number }> => {
    try {
      // Используем локальный API-эндпоинт, который обращается к Nest API
      try {
        const checkUrl = `/api/speedtest-proxy/check-servers?server=${encodeURIComponent(
          server.server
        )}&noCache=${Date.now()}`;

        console.log(`🔍 Проверка сервера через локальный API: ${server.name}`);

        const startTime = performance.now();
        const response = await fetch(checkUrl, {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });
        const endTime = performance.now();
        const pingTime = Math.round(endTime - startTime);

        if (response.ok) {
          const data = await response.json();

          console.log(
            `✅ Сервер ${server.name} проверен: доступен=${data.available}, пинг=${pingTime}ms`
          );
          return { available: data.available, pingTime };
        } else {
          console.warn(`⚠️ Неудачный ответ от API: ${response.status}`);
        }
      } catch (apiError) {
        console.warn(`⚠️ Ошибка при проверке через API: ${apiError}`);
      }

      // Прямая проверка через прокси (запасной вариант)
      console.log(`🔍 Прямая проверка сервера: ${server.name}`);

      // Определяем путь для проверки доступности
      const pingPath = server.pingURL || normalizePath(server, "empty.php");

      // Проверяем доступность сервера через наш прокси
      const url = `/api/speedtest-proxy?path=${encodeURIComponent(
        pingPath
      )}&server=${encodeURIComponent(server.server)}&t=${Date.now()}`;

      console.log(`🔍 Прямая проверка сервера ${server.name}: ${url}`);

      // Увеличиваем таймаут до 5 секунд
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const startTime = performance.now();
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        // Добавляем заголовок для предотвращения кэширования
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      const endTime = performance.now();
      const pingTime = Math.round(endTime - startTime);

      clearTimeout(timeoutId);
      return { available: response.ok, pingTime };
    } catch (err) {
      console.error(`❌ Сервер ${server.name} недоступен:`, err);

      // Повторяем попытку, если установлено число повторов
      if (retries > 0) {
        console.log(
          `🔄 Повторная попытка для сервера ${server.name}, осталось попыток: ${retries}`
        );
        return checkServerAvailability(server, retries - 1);
      }

      return { available: false };
    }
  };

  // Загрузка списка серверов с бэкенда Nest.js или использование запасных
  useEffect(() => {
    const fetchServers = async () => {
      try {
        setIsLoading(true);
        let serverList: LibreSpeedServer[] = [];

        try {
          // Используем API Nest.js для получения серверов
          const response = await fetch(
            "http://localhost:3001/api/speedtest/librespeed/servers"
          );

          if (response.ok) {
            const data: NestServerResponse = await response.json();
            if (
              data.success &&
              Array.isArray(data.servers) &&
              data.servers.length > 0
            ) {
              serverList = data.servers;
              console.log(
                "✅ Получен список серверов с Nest.js бэкенда:",
                serverList
              );
            } else {
              console.warn(
                "⚠️ Получен пустой список серверов с бэкенда, используем запасные серверы"
              );
              serverList = fallbackServers;
            }
          } else {
            throw new Error(
              `Ошибка при получении серверов: ${response.status}`
            );
          }
        } catch (apiError) {
          console.error("❌ Ошибка при обращении к API:", apiError);
          console.log("⚠️ Используем запасные серверы");
          serverList = fallbackServers;
        }

        if (serverList.length > 0) {
          // Добавляем метаданные к серверам
          const serversWithMeta = serverList.map((server) => ({
            ...server,
            available: undefined,
            checked: false,
            pingResult: undefined,
          }));

          setServers(serversWithMeta);

          // Запускаем проверку доступности серверов
          setIsCheckingServers(true);
        } else {
          throw new Error("Не удалось получить список серверов");
        }
      } catch (err) {
        console.error("❌ Ошибка при загрузке серверов:", err);
        setError(
          "Не удалось загрузить список серверов. Пожалуйста, обновите страницу."
        );
        if (err instanceof Error) {
          setErrorDetails(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchServers();
  }, []);

  // Проверка доступности серверов с сортировкой по пингу
  useEffect(() => {
    const checkServers = async () => {
      if (!isCheckingServers || servers.length === 0) return;

      console.log("🔍 Проверяем доступность серверов...");

      const availableSrvs: ServerWithMeta[] = [];
      let checkedCount = 0;

      // Проверяем каждый сервер последовательно
      for (const server of servers) {
        const result = await checkServerAvailability(server);
        server.available = result.available;
        server.pingResult = result.pingTime;
        server.checked = true;

        checkedCount++;
        setCheckProgress(Math.floor((checkedCount / servers.length) * 100));

        if (result.available) {
          console.log(
            `✅ Сервер ${server.name} доступен (пинг: ${
              result.pingTime || "неизвестно"
            } мс)`
          );
          availableSrvs.push(server);
        } else {
          console.log(`❌ Сервер ${server.name} недоступен`);
        }
      }

      // Сортируем доступные серверы по пингу (от меньшего к большему)
      const sortedServers = [...availableSrvs].sort((a, b) => {
        // Если у обоих серверов есть результаты пинга, сортируем по ним
        if (a.pingResult !== undefined && b.pingResult !== undefined) {
          return a.pingResult - b.pingResult;
        }
        // Если только у одного есть результат пинга, он идет первым
        if (a.pingResult !== undefined) return -1;
        if (b.pingResult !== undefined) return 1;
        // Если ни у одного нет результата, сохраняем исходный порядок
        return 0;
      });

      // Обновляем список доступных серверов
      setAvailableServers(sortedServers);

      // Если есть доступные серверы, выбираем первый (с наименьшим пингом)
      if (sortedServers.length > 0) {
        setSelectedServer(sortedServers[0].server);
        console.log(`✅ Найдено ${sortedServers.length} доступных серверов`);
      } else {
        console.error("❌ Нет доступных серверов!");
        setError(
          "Нет доступных серверов для тестирования. Пожалуйста, попробуйте позже."
        );
      }

      setIsCheckingServers(false);
    };

    checkServers();
  }, [isCheckingServers, servers]);

  // Конфигурация выбранного сервера
  useEffect(() => {
    if (selectedServer && availableServers.length > 0) {
      configureSpeedtest();
    }
  }, [selectedServer, availableServers]);

  // Функция для настройки теста скорости с выбранным сервером
  const configureSpeedtest = () => {
    if (!selectedServer) return;

    const serverObj = availableServers.find((s) => s.server === selectedServer);

    if (!serverObj) {
      console.error(
        "❌ Выбранный сервер не найден в списке доступных серверов"
      );
      return;
    }

    // Сохраняем активный сервер в ref для доступа в обработчиках
    activeServerRef.current = serverObj;

    console.log(
      `🔄 Настройка сервера: ${serverObj.name} (${serverObj.server})`
    );

    // Определяем пути к файлам для тестирования с учетом возможных backend/ путей
    const dlPath = serverObj.dlURL || normalizePath(serverObj, "garbage.php");
    const ulPath = serverObj.ulURL || normalizePath(serverObj, "empty.php");
    const pingPath = serverObj.pingURL || normalizePath(serverObj, "empty.php");
    const ipPath = serverObj.getIpURL || normalizePath(serverObj, "getIP.php");

    // Выводим информацию о путях
    console.log(
      `📂 Пути к файлам: dl=${dlPath}, ul=${ulPath}, ping=${pingPath}`
    );

    // Добавляем случайное число к URL для предотвращения кэширования
    const cacheBuster = Date.now();

    // Проверяем, есть ли у сервера "backend" в имени домена
    const serverHasBackendInName =
      serverObj.server.includes(".backend.") ||
      serverObj.server.includes("/backend");

    console.log(
      `📊 Анализ сервера: имеет backend в имени=${serverHasBackendInName}`
    );

    // Важно: настраиваем URL для использования нашего прокси вместо прямых запросов
    // URL для тестирования загрузки (download)
    const downloadUrl = `/api/speedtest-proxy?path=${encodeURIComponent(
      dlPath
    )}&server=${encodeURIComponent(serverObj.server)}&t=${cacheBuster}`;

    // URL для тестирования выгрузки (upload)
    const uploadUrl = `/api/speedtest-proxy?path=${encodeURIComponent(
      ulPath
    )}&server=${encodeURIComponent(serverObj.server)}&t=${cacheBuster}`;

    // URL для тестирования пинга
    const pingUrl = `/api/speedtest-proxy?path=${encodeURIComponent(
      pingPath
    )}&server=${encodeURIComponent(serverObj.server)}&t=${cacheBuster}`;

    // URL для получения IP (необязательно)
    const ipUrl = `/api/speedtest-proxy?path=${encodeURIComponent(
      ipPath
    )}&server=${encodeURIComponent(serverObj.server)}&t=${cacheBuster}`;

    // Логируем созданные URL для отладки
    console.log(`🌐 URL для загрузки: ${downloadUrl}`);
    console.log(`🌐 URL для выгрузки: ${uploadUrl}`);
    console.log(`🌐 URL для пинга: ${pingUrl}`);

    // Если уже есть инстанс тестирования, удаляем его для создания нового
    if (speedtestRef.current) {
      try {
        speedtestRef.current.abort();
      } catch (e) {
        // Игнорируем ошибки при отмене
      }
      speedtestRef.current = null;
    }

    // Создаем новый инстанс SimpleSpeedTest
    try {
      speedtestRef.current = new SimpleSpeedTest({
        url_dl: downloadUrl,
        url_ul: uploadUrl,
        url_ping: pingUrl,
        url_getIp: ipUrl,
        test_order: "P_D_U", // Изменен порядок тестов: ping, download, upload
        time_dl_max: 10, // максимальное время теста загрузки в секундах
        time_ul_max: 15, // максимальное время теста выгрузки в секундах (было 30)
        count_ping: 10, // количество пингов для усреднения
        time_auto: true, // автоматическая адаптация времени теста
        xhr_dlMultistream: 3, // Количество параллельных потоков для загрузки
        xhr_ulMultistream: 3, // Количество параллельных потоков для выгрузки
        xhr_ignoreErrors: 1, // игнорируем мелкие ошибки
        overheadCompensationFactor: 1.06, // Компенсация накладных расходов протокола
      });

      // Дополнительный тест для проверки пинга перед запуском основного теста
      fetch(pingUrl, {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
      })
        .then((response) => {
          if (response.ok) {
            console.log("✅ Предварительная проверка пинга успешна");
          } else {
            console.warn(
              `⚠️ Предварительная проверка пинга вернула статус: ${response.status}`
            );
          }
          setIsReady(true);
        })
        .catch((err) => {
          console.error("❌ Ошибка при предварительной проверке пинга:", err);
          // Всё равно устанавливаем готовность, но с предупреждением
          setDiagnosticInfo(
            (prev) =>
              prev + "\n⚠️ Предупреждение: возможны проблемы с соединением"
          );
          setIsReady(true);
        });
    } catch (error) {
      console.error("❌ Ошибка при настройке теста:", error);
      setError("Ошибка при настройке теста скорости");
      if (error instanceof Error) {
        setErrorDetails(error.message);
      }
    }
  };

  // Функция запуска теста
  const startTest = () => {
    if (!speedtestRef.current || !isReady) {
      console.error("❌ Не удалось запустить тест: тест не готов");
      return;
    }

    setIsRunning(true);
    isTestStartedRef.current = true;

    const speedtest = speedtestRef.current;

    // Сбрасываем ошибки и результаты
    setError("");
    setErrorDetails("");
    setResults({
      ping: "--",
      jitter: "--",
      download: "--",
      upload: "--",
    });

    // Настраиваем обработчик для обновления результатов во время теста
    speedtest.onupdate = (data: SpeedTestProgress) => {
      console.log("🔄 Обновление результатов:", data);

      setTestState(data.testState);

      // Обновляем диагностическую информацию
      const stateNames = [
        "WAITING",
        "PING",
        "DOWNLOAD",
        "UPLOAD",
        "FINISHED",
        "ABORTED",
      ];
      const stateName = stateNames[data.testState] || String(data.testState);
      setDiagnosticInfo(`Текущее состояние: ${stateName}`);

      // Обновляем результаты
      setResults({
        ping: data.pingStatus || "--",
        jitter: data.jitterStatus || "--",
        download: data.dlStatus || "--",
        upload: data.ulStatus || "--",
      });
    };

    // Обработчик завершения теста
    speedtest.onend = (aborted: boolean) => {
      console.log(`✅ Тест завершен${aborted ? " (прерван)" : ""}`);

      setIsRunning(false);
      isTestStartedRef.current = false;

      if (aborted) {
        setError("Тест был прерван.");
      }

      // Получаем и выводим финальные результаты
      const finalResults = speedtest.getResults();
      console.log("📊 Финальные результаты:", finalResults);
    };

    try {
      console.log("🚀 Запуск теста SimpleSpeedTest");

      // Запускаем тест
      speedtest.start();
    } catch (err) {
      console.error("❌ Ошибка при запуске теста:", err);
      setError(
        "Не удалось запустить тест. Проверьте консоль для подробностей."
      );
      if (err instanceof Error) {
        setErrorDetails(err.message);
      }
      setIsRunning(false);
      isTestStartedRef.current = false;
    }
  };

  // Функция для отмены теста
  const abortTest = () => {
    if (!speedtestRef.current || !isRunning) return;

    speedtestRef.current.abort();
    isTestStartedRef.current = false;
    setIsRunning(false);
  };

  // Обработчик изменения выбранного сервера
  const handleServerChange = (value: string | null) => {
    if (value) {
      setSelectedServer(value);
      setIsReady(false); // Сбрасываем готовность, пока не настроим новый сервер
    }
  };

  return (
    <Card withBorder shadow="sm" padding="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Text fw={500}>LibreSpeed Test</Text>
        {!isLoading && !isCheckingServers && availableServers.length > 0 && (
          <Group gap="sm">
            <Select
              placeholder="Выберите сервер"
              value={selectedServer}
              onChange={handleServerChange}
              data={availableServers.map((server) => ({
                value: server.server,
                label: `${server.name} ${
                  server.pingResult ? `(${server.pingResult}ms)` : ""
                }`,
              }))}
              disabled={isRunning}
              w={250}
            />
            {selectedServer && (
              <Badge color="blue">
                {availableServers.find((s) => s.server === selectedServer)
                  ?.country || ""}
              </Badge>
            )}
          </Group>
        )}
      </Group>

      {error && (
        <Alert color="red" title="Ошибка" withCloseButton={false} mb="sm">
          {error}
          {errorDetails && (
            <Code block mt="xs" style={{ whiteSpace: "pre-wrap" }}>
              {errorDetails}
            </Code>
          )}
        </Alert>
      )}

      {isLoading && (
        <Text size="sm" c="dimmed">
          Загрузка списка серверов...
        </Text>
      )}

      {isCheckingServers && (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Проверка доступности серверов...
          </Text>
          <Progress value={checkProgress} size="sm" radius="xl" />
        </Stack>
      )}

      {!isLoading &&
        !isCheckingServers &&
        availableServers.length === 0 &&
        !error && (
          <Text size="sm" c="dimmed">
            Нет доступных серверов для тестирования.
          </Text>
        )}

      {!isLoading &&
        !isCheckingServers &&
        !isReady &&
        availableServers.length > 0 &&
        !error && (
          <Text size="sm" c="dimmed">
            Подготовка к тесту...
          </Text>
        )}

      <Group mt="md">
        {isReady && !isRunning && (
          <Button
            onClick={startTest}
            disabled={!isReady || isRunning || availableServers.length === 0}
            size="sm"
            color="blue"
          >
            Запустить тест LibreSpeed
          </Button>
        )}
        {isRunning && (
          <Button onClick={abortTest} size="sm" color="red">
            Остановить
          </Button>
        )}
      </Group>

      {diagnosticInfo && (
        <Alert mt="sm" color="blue" title="Диагностика" withCloseButton={false}>
          {diagnosticInfo}
          {retryCount > 0 && (
            <Text size="sm" mt="xs">
              Повторных попыток: {retryCount}
            </Text>
          )}
        </Alert>
      )}

      <Table mt="md">
        <tbody>
          <tr>
            <td>Ping</td>
            <td>
              <Text fw={500}>{results.ping} ms</Text>
            </td>
          </tr>
          <tr>
            <td>Jitter</td>
            <td>
              <Text fw={500}>{results.jitter} ms</Text>
            </td>
          </tr>
          <tr>
            <td>Download</td>
            <td>
              <Text fw={500}>{results.download} Mbps</Text>
            </td>
          </tr>
          <tr>
            <td>Upload</td>
            <td>
              <Text fw={500}>{results.upload} Mbps</Text>
            </td>
          </tr>
        </tbody>
      </Table>

      <Text size="xs" c="dimmed" mt="sm">
        * Тест выполняется напрямую между вашим браузером и выбранным сервером
        через CORS-прокси
      </Text>
    </Card>
  );
};

export default DirectLibreSpeedTest;
