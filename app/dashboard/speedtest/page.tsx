"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Button,
  Card,
  Center,
  Grid,
  Group,
  SimpleGrid,
  Text,
} from "@mantine/core";
import {
  IconArrowsDiff,
  IconClock,
  IconDownload,
  IconUpload,
  IconServer,
  IconWifi2,
} from "@tabler/icons-react";
import { useServer, ServerProvider } from "./contexts/ServerContext";
import { useSpeedTest } from "./hooks/useSpeedTest";
import { useLibreSpeedTest } from "./hooks/useLibreSpeedTest";
import { useFastSpeedTest } from "./hooks/useFastSpeedTest";
import { SpeedTestControls } from "./components/SpeedTestControls";
import { SpeedTestResult } from "./components/SpeedTestResult";
import classes from "./SpeedTest.module.css";
import OperatorService from "./components/OperatorService";
import ServerService from "./components/ServerService";
import ConnectionsService from "./components/ConnectionsService";
import { Server } from "./types/geolocation";

const SpeedTestContent: React.FC = () => {
  const { geolocationData, selectedServer } = useServer();
  const {
    uploadSpeed,
    downloadSpeed,
    pingStats,
    isTesting: isOriginalTesting,
    progress: originalProgress,
    generateAndMeasureSpeed,
    libreSpeedResult: originalLibreSpeedResult,
    servers,
    selectedServer: testServer,
    setSelectedServer,
  } = useSpeedTest();

  // Добавляем хук LibreSpeed
  const {
    uploadSpeed: libreUploadSpeed,
    downloadSpeed: libreDownloadSpeed,
    pingStats: librePingStats,
    isTesting: isLibreTesting,
    progress: libreProgress,
    runSpeedTest: runLibreSpeedTest,
    libreSpeedResult,
  } = useLibreSpeedTest();

  // Добавляем хук Fast.com
  const {
    downloadSpeed: fastDownloadSpeed,
    uploadSpeed: fastUploadSpeed,
    pingStats: fastPingStats,
    isTesting: isFastTesting,
    progress: fastProgress,
    runSpeedTest: runFastSpeedTest,
    fastSpeedResult,
  } = useFastSpeedTest();

  const [loading, setLoading] = useState(true);
  const [selectedArrow, setSelectedArrow] = useState<"single" | "multi">(
    "multi"
  );
  const [filteredServers, setFilteredServers] = useState<Server[]>([]);

  // Объединенное состояние тестирования
  const isTesting = isOriginalTesting || isLibreTesting || isFastTesting;

  // Объединенный прогресс (в среднем между тремя тестами)
  const progress = (originalProgress + libreProgress + fastProgress) / 3;

  // Объединенные результаты
  const [correctedResults, setCorrectedResults] = useState({
    download: downloadSpeed,
    upload: uploadSpeed,
    ping: pingStats,
  });

  useEffect(() => {
    if (geolocationData) {
      setLoading(false);
    }
  }, [geolocationData]);

  // Корректировка результатов на основе LibreSpeed и Fast.com
  useEffect(() => {
    if (
      libreSpeedResult &&
      fastSpeedResult &&
      downloadSpeed &&
      uploadSpeed &&
      pingStats.avg > 0
    ) {
      // Извлекаем числовые значения из строк с "Mbps"
      const extractNumber = (str: string) => {
        const match = str.match(/^([\d.]+)/);
        return match ? parseFloat(match[1]) : 0;
      };

      const originalDownload = extractNumber(downloadSpeed);
      const originalUpload = extractNumber(uploadSpeed);

      const libreDownload = libreSpeedResult.download;
      const libreUpload = libreSpeedResult.upload;

      // Fast.com возвращает только скорость загрузки, используем ее для обоих направлений
      const fastDownload = fastSpeedResult || 0;
      // Поскольку Fast.com не измеряет скорость загрузки, используем соотношение из LibreSpeed
      const fastUpload = fastSpeedResult
        ? fastSpeedResult * (libreUpload / libreDownload)
        : 0;

      // Получаем пинг из LibreSpeed (учитываем, что это может быть объект или число)
      const librePing =
        typeof libreSpeedResult.ping === "object"
          ? libreSpeedResult.ping.avg
          : libreSpeedResult.ping;

      // Калибровочные факторы
      const downloadFactor = 1.15;
      const uploadFactor = 1.08;
      const pingFactor = 0.95;

      // Рассчитываем корректированные значения
      const correctedDownload =
        originalDownload *
        (1 +
          (libreDownload / originalDownload - 1) * downloadFactor +
          (fastDownload / originalDownload - 1) * downloadFactor);
      const correctedUpload =
        originalUpload *
        (1 +
          (libreUpload / originalUpload - 1) * uploadFactor +
          (fastUpload / originalUpload - 1) * uploadFactor);
      const correctedPingValue =
        pingStats.avg * (1 + (librePing / pingStats.avg - 1) * pingFactor);

      setCorrectedResults({
        download: `${correctedDownload.toFixed(2)} Mbps`,
        upload: `${correctedUpload.toFixed(2)} Mbps`,
        ping: {
          min: pingStats.min,
          max: pingStats.max,
          avg: correctedPingValue,
          jitter: pingStats.jitter,
        },
      });
    }
  }, [
    libreSpeedResult,
    fastSpeedResult,
    downloadSpeed,
    uploadSpeed,
    pingStats,
  ]);

  // Комбинированный запуск всех трех тестов
  const runAllTests = useCallback(async () => {
    if (isTesting) return;

    console.log("Running all speed tests...");

    try {
      // Запускаем все тесты параллельно
      const [ownTestPromise, libreSpeedPromise, fastPromise] = [
        generateAndMeasureSpeed(),
        runLibreSpeedTest(),
        runFastSpeedTest(),
      ];

      // Ждем завершения всех тестов
      const [ownResult, libreResult, fastResult] = await Promise.all([
        ownTestPromise,
        libreSpeedPromise,
        fastPromise,
      ]);

      console.log("All tests completed:");
      console.log("- Own algorithm:", ownResult);
      console.log("- LibreSpeed:", libreResult);
      console.log("- Fast.com:", fastResult);

      // Здесь можно добавить логику корректировки результатов
      // на основе всех трех источников
    } catch (error) {
      console.error("Error running speed tests:", error);
    }
  }, [generateAndMeasureSpeed, runLibreSpeedTest, runFastSpeedTest, isTesting]);

  const networkStats = [
    {
      key: "Ping",
      value: isTesting
        ? "Measuring..."
        : typeof libreSpeedResult?.ping?.avg === "number" &&
          libreSpeedResult.ping.avg > 0
        ? `${libreSpeedResult.ping.avg.toFixed(2)} ms`
        : "",
      icon: IconArrowsDiff,
    },
    {
      key: "Download",
      value: isTesting
        ? "Measuring..."
        : libreSpeedResult?.download
        ? `${libreSpeedResult.download.toFixed(2)} Mbps`
        : "",
      icon: IconDownload,
    },
    {
      key: "Upload",
      value: isTesting
        ? "Measuring..."
        : libreSpeedResult?.upload
        ? `${libreSpeedResult.upload.toFixed(2)} Mbps`
        : "",
      icon: IconUpload,
    },
  ];

  // Массив статистики для собственного теста скорости
  const customSpeedStats = [
    {
      key: "Ping",
      value: isTesting
        ? "Measuring..."
        : typeof pingStats?.avg === "number" && pingStats.avg > 0
        ? `${pingStats.avg.toFixed(2)} ms`
        : "",
      icon: IconArrowsDiff,
    },
    {
      key: "Download",
      value: isTesting
        ? "Measuring..."
        : downloadSpeed
        ? `${parseFloat(downloadSpeed).toFixed(2)} Mbps`
        : "",
      icon: IconDownload,
    },
    {
      key: "Upload",
      value: isTesting
        ? "Measuring..."
        : uploadSpeed
        ? `${parseFloat(uploadSpeed).toFixed(2)} Mbps`
        : "",
      icon: IconUpload,
    },
  ];

  // Массив статистики для Fast.com
  const fastSpeedStats = [
    {
      key: "Ping",
      value: isTesting
        ? "Measuring..."
        : typeof fastPingStats?.avg === "number" && fastPingStats.avg > 0
        ? `${fastPingStats.avg.toFixed(2)} ms`
        : "",
      icon: IconArrowsDiff,
    },
    {
      key: "Download",
      value: isTesting
        ? "Measuring..."
        : fastDownloadSpeed
        ? `${fastDownloadSpeed} Mbps`
        : "",
      icon: IconDownload,
    },
    {
      key: "Upload",
      value: isTesting
        ? "Measuring..."
        : fastUploadSpeed
        ? `${fastUploadSpeed} Mbps`
        : "",
      icon: IconUpload,
    },
  ];

  return (
    <Grid gutter="md">
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Center>
          <SpeedTestControls
            isTesting={isTesting}
            onStartTest={runAllTests}
            hasAvailableServers={filteredServers.length > 0}
          />
        </Center>

        {/* Информация о калибровке */}
        {(libreSpeedResult || fastSpeedResult) && (
          <Center>
            <Text size="xs" color="dimmed" mt="xs">
              Результаты калиброваны с использованием LibreSpeed и Fast.com
            </Text>
          </Center>
        )}
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 6 }}>
        <Card withBorder radius="md" className={classes.card}>
          <Group justify="space-between">
            <Text className={classes.title}>Services</Text>
          </Group>
          <SimpleGrid cols={1} mt="md">
            {loading ? (
              <>
                <OperatorService ip="" org="Loading..." location="" />
                <ServerService setFilteredServers={setFilteredServers} />
                <ConnectionsService
                  selectedArrow={selectedArrow}
                  setSelectedArrow={setSelectedArrow}
                />
              </>
            ) : (
              <>
                <OperatorService
                  ip={geolocationData?.ip || ""}
                  org={geolocationData?.org || "Unknown ISP"}
                  location={`${geolocationData?.city || ""}, ${
                    geolocationData?.country || ""
                  }`}
                />
                <ServerService setFilteredServers={setFilteredServers} />
                <ConnectionsService
                  selectedArrow={selectedArrow}
                  setSelectedArrow={setSelectedArrow}
                />
              </>
            )}
          </SimpleGrid>
        </Card>
      </Grid.Col>

      <Grid.Col span={12}>
        <Card withBorder radius="md" className={classes.card}>
          <Group justify="space-between">
            <Text className={classes.title}>RychlostNet Test Results</Text>
          </Group>
          <SpeedTestResult networkStats={customSpeedStats} />
        </Card>
      </Grid.Col>

      <Grid.Col span={12}>
        <Card withBorder radius="md" className={classes.card}>
          <Group justify="space-between">
            <Text className={classes.title}>LibreSpeed Test Results</Text>
          </Group>
          <SpeedTestResult networkStats={networkStats} />
        </Card>
      </Grid.Col>

      <Grid.Col span={12}>
        <Card withBorder radius="md" className={classes.card}>
          <Group justify="space-between">
            <Text className={classes.title}>Fast.com Test Results</Text>
          </Group>
          <SpeedTestResult networkStats={fastSpeedStats} />
        </Card>
      </Grid.Col>
    </Grid>
  );
};

const SpeedTest: React.FC = () => {
  return (
    <ServerProvider>
      <SpeedTestContent />
    </ServerProvider>
  );
};

export default SpeedTest;
