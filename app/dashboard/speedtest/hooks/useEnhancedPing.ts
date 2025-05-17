import { useState, useCallback } from 'react';
import { PingStats } from './utils/types';

export interface EnhancedPingResult extends PingStats {
  pingDetails: number[];
  timestamp: string;
}

export const useEnhancedPing = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [pingResult, setPingResult] = useState<EnhancedPingResult | null>(null);
  
  // Функция обработки результатов пинг-теста
  const handlePingResult = useCallback((result: PingStats & { pingDetails: number[] }) => {
    // Добавляем временную метку
    const enhancedResult: EnhancedPingResult = {
      ...result,
      timestamp: new Date().toISOString()
    };
    
    // Сохраняем результат
    setPingResult(enhancedResult);
    
    // Логируем для отладки
    // console.log("✅ Результаты улучшенного пинг-теста:", enhancedResult);
    // console.log("📊 Все измерения:", enhancedResult.pingDetails.map(p => p + " мс").join(", "));
    
    return enhancedResult;
  }, []);
  
  // Функция запуска теста пинга напрямую из хука (если нужно)
  const runPingTest = useCallback(async (): Promise<EnhancedPingResult | null> => {
    if (isRunning) return null;
    
    setIsRunning(true);
    
    try {
      // Массив для хранения результатов пинга
      const pings: number[] = [];
      
      // Предварительно "разогреваем" соединение
      await fetch("https://www.cloudflare.com/cdn-cgi/trace", {
        cache: 'no-store'
      });
      
      // Список легких эндпоинтов для проверки пинга
      const pingUrls = [
        "https://www.cloudflare.com/cdn-cgi/trace",  // Cloudflare трассировка
        "https://cloudflare.com/cdn-cgi/trace",      // Cloudflare вариант 2
        "https://1.1.1.1/cdn-cgi/trace",             // DNS Cloudflare
        "https://www.google.com/generate_204",       // Google 204 ответ (пустой)
        "https://www.apple.com/library/test/success.html" // Apple тестовая страница
      ];
      
      // Делаем запросы к разным эндпоинтам для более точного измерения
      for (let i = 0; i < pingUrls.length; i++) {
        const url = pingUrls[i];
        const startTime = performance.now(); // Более точное время
        
        await fetch(url, {
          cache: 'no-store', // Отключаем кэширование
          mode: 'no-cors',   // Режим no-cors для некоторых ресурсов
          headers: {
            'Accept': '*/*',
            'Cache-Control': 'no-cache'
          }
        });
        
        const endTime = performance.now();
        const pingTime = endTime - startTime;
        pings.push(pingTime);
        
        // Небольшая пауза между запросами
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Сортируем результаты и убираем самый высокий и низкий для устранения выбросов
      pings.sort((a, b) => a - b);
      
      // Берем 3 средних значения (если есть 5) для более точной оценки
      const filteredPings = pings.length >= 5 
        ? pings.slice(1, pings.length - 1) 
        : pings;
      
      // Вычисляем средний пинг
      const avgPing = filteredPings.reduce((sum, time) => sum + time, 0) / filteredPings.length;
      
      // Вычисляем джиттер (нестабильность соединения)
      let jitter = 0;
      for (let i = 1; i < filteredPings.length; i++) {
        jitter += Math.abs(filteredPings[i] - filteredPings[i-1]);
      }
      const avgJitter = filteredPings.length > 1 ? jitter / (filteredPings.length - 1) : 0;
      
      const result: EnhancedPingResult = {
        min: Math.round(pings[0]),
        max: Math.round(pings[pings.length-1]),
        avg: Math.round(avgPing),
        jitter: Math.round(avgJitter),
        pingDetails: pings.map(p => Math.round(p)),
        timestamp: new Date().toISOString()
      };
      
      // Сохраняем результат
      setPingResult(result);
      
      // Возвращаем результат
      return result;
      
    } catch (error) {
      // console.error("❌ Ошибка при измерении пинга:", error);
      return null;
    } finally {
      setIsRunning(false);
    }
  }, [isRunning]);
  
  return {
    pingResult,
    isRunning,
    handlePingResult,
    runPingTest
  };
}; 