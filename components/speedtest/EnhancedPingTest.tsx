import React, { useEffect, useState, useRef } from "react";
import {
  Card,
  Text,
  Group,
  SimpleGrid,
  Button,
  Divider,
  Badge,
} from "@mantine/core";
import { IconArrowsDiff, IconWaveSine } from "@tabler/icons-react";
import { StatItem } from "../../app/dashboard/speedtest/components/StatItem";
import { PingStats } from "../../app/dashboard/speedtest/hooks/utils/types";

interface EnhancedPingTestProps {
  onPingResult?: (result: PingStats & { pingDetails: number[] }) => void;
}

export const EnhancedPingTest: React.FC<EnhancedPingTestProps> = ({
  onPingResult,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [pingResult, setPingResult] = useState<
    (PingStats & { pingDetails: number[] }) | null
  >(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const runPingTest = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setPingResult(null);

    try {
      // Массив для хранения результатов пинга
      const pings: number[] = [];

      // Предварительно "разогреваем" соединение
      await fetch("https://www.cloudflare.com/cdn-cgi/trace", {
        cache: "no-store",
      });

      // Список легких эндпоинтов для проверки пинга
      const pingUrls = [
        "https://www.cloudflare.com/cdn-cgi/trace", // Cloudflare трассировка
        "https://cloudflare.com/cdn-cgi/trace", // Cloudflare вариант 2
        "https://1.1.1.1/cdn-cgi/trace", // DNS Cloudflare
        "https://www.google.com/generate_204", // Google 204 ответ (пустой)
        "https://www.apple.com/library/test/success.html", // Apple тестовая страница
      ];

      // Делаем запросы к разным эндпоинтам для более точного измерения
      for (let i = 0; i < pingUrls.length; i++) {
        const url = pingUrls[i];
        const startTime = performance.now(); // Более точное время

        await fetch(url, {
          cache: "no-store", // Отключаем кэширование
          mode: "no-cors", // Режим no-cors для некоторых ресурсов
          headers: {
            Accept: "*/*",
            "Cache-Control": "no-cache",
          },
        });

        const endTime = performance.now();
        const pingTime = endTime - startTime;
        pings.push(pingTime);

        console.log(`Пинг к ${url}: ${pingTime.toFixed(1)} мс`);

        // Небольшая пауза между запросами
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Сортируем результаты по возрастанию
      pings.sort((a, b) => a - b);

      // Сохраняем все результаты для отображения
      const allPings = [...pings];

      // МОДИФИКАЦИЯ: Отбрасываем ДВА самых больших результата, чтобы избежать аномально высоких значений
      // Проверяем, достаточно ли у нас данных для отбрасывания
      if (pings.length > 3) {
        // Удаляем два последних (самых больших) элемента
        pings.splice(-2);
        console.log(
          "Удалены два самых больших результата:",
          allPings.slice(-2).map((p) => Math.round(p)),
          "мс"
        );
      }

      // Теперь вычисляем средние значения на основе отфильтрованных данных
      const avgPing = pings.reduce((sum, time) => sum + time, 0) / pings.length;

      // Вычисляем джиттер (нестабильность соединения)
      let jitter = 0;
      for (let i = 1; i < pings.length; i++) {
        jitter += Math.abs(pings[i] - pings[i - 1]);
      }
      const avgJitter = pings.length > 1 ? jitter / (pings.length - 1) : 0;

      const result = {
        min: Math.round(pings[0]),
        max: Math.round(pings[pings.length - 1]),
        avg: Math.round(avgPing),
        jitter: Math.round(avgJitter),
        pingDetails: allPings.map((p) => Math.round(p)), // Сохраняем все результаты для отображения
      };

      setPingResult(result);

      // Вызываем колбэк с результатом, если он предоставлен
      if (onPingResult) {
        onPingResult(result);
      }
    } catch (error) {
      console.error("Ошибка при измерении пинга:", error);
    } finally {
      setIsRunning(false);
    }
  };

  const networkStats = pingResult
    ? [
        {
          key: "Пинг",
          value: `${pingResult.avg} мс`,
          icon: IconArrowsDiff,
        },
        {
          key: "Джиттер",
          value: `${pingResult.jitter} мс`,
          icon: IconWaveSine,
        },
        {
          key: "Мин. пинг",
          value: `${pingResult.min} мс`,
          icon: IconArrowsDiff,
        },
        {
          key: "Макс. пинг",
          value: `${pingResult.max} мс`,
          icon: IconArrowsDiff,
        },
      ]
    : [
        {
          key: "Пинг",
          value: isRunning ? "Измерение..." : "",
          icon: IconArrowsDiff,
        },
        {
          key: "Джиттер",
          value: isRunning ? "Измерение..." : "",
          icon: IconWaveSine,
        },
        {
          key: "Мин. пинг",
          value: isRunning ? "Измерение..." : "",
          icon: IconArrowsDiff,
        },
        {
          key: "Макс. пинг",
          value: isRunning ? "Измерение..." : "",
          icon: IconArrowsDiff,
        },
      ];

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" mb="md">
        <Text fw={700} size="lg">
          Улучшенное измерение пинга
        </Text>
        <Button
          onClick={runPingTest}
          loading={isRunning}
          disabled={isRunning}
          data-enhanced-ping-test-button
        >
          {isRunning ? "Выполняется тест..." : "Запустить тест"}
        </Button>
      </Group>

      <SimpleGrid cols={2}>
        {networkStats.map((stat) => {
          const { key, ...rest } = stat;
          return <StatItem key={key} statKey={key} {...rest} />;
        })}
      </SimpleGrid>

      {pingResult && (
        <>
          <Divider my="sm" />
          <Text size="sm" fw={500} mb="xs">
            Все измерения (мс):
          </Text>
          <Group>
            {pingResult.pingDetails.map((ping, index) => (
              <Badge key={index} size="lg">
                {ping}
              </Badge>
            ))}
          </Group>
          <Text size="xs" c="dimmed" mt="xs">
            Время: {new Date().toLocaleTimeString()}
          </Text>
        </>
      )}
    </Card>
  );
};

export default EnhancedPingTest;
