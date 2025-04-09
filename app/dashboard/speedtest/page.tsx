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
import { CorrectedResults } from "./components/CorrectedResults";

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
    checkingServers,
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

  // Новое состояние для хранения окончательных результатов из компонента
  const [finalResults, setFinalResults] = useState<{
    ping: { value: number; source: string };
    download: { value: number; source: string };
    upload: { value: number; source: string };
  } | null>(null);

  // Флаг, указывающий, что результаты были уже сохранены
  const [resultsSaved, setResultsSaved] = useState(false);

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

      // Извлекаем fast.com результаты - ИСПРАВЛЕНИЕ
      const fastResultAny = fastSpeedResult as any;
      const fastDownloadValue =
        typeof fastDownloadSpeed === "string"
          ? extractNumber(fastDownloadSpeed)
          : fastResultAny && typeof fastResultAny.download === "number"
          ? fastResultAny.download
          : 0;
      const fastUploadValue =
        typeof fastUploadSpeed === "string"
          ? extractNumber(fastUploadSpeed)
          : fastResultAny && typeof fastResultAny.upload === "number"
          ? fastResultAny.upload
          : 0;

      let bestDownload = Math.max(
        originalDownload,
        libreDownload,
        fastDownloadValue
      );
      let bestUpload = Math.max(originalUpload, libreUpload, fastUploadValue);

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
          (fastDownloadValue / originalDownload - 1) * downloadFactor);
      const correctedUpload =
        originalUpload *
        (1 +
          (libreUpload / originalUpload - 1) * uploadFactor +
          (fastUploadValue / originalUpload - 1) * uploadFactor);
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

    // Сбрасываем финальные результаты перед запуском нового теста
    setFinalResults(null);
    // Сбрасываем флаг сохранения
    setResultsSaved(false);

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

      // Остальные данные будут обработаны в handleResultsCalculated
    } catch (error) {
      console.error("Error running speed tests:", error);
    }
  }, [generateAndMeasureSpeed, runLibreSpeedTest, runFastSpeedTest, isTesting]);

  // Функция для сохранения результатов теста
  const saveTestResults = useCallback(
    async (results: {
      ping: { value: number; source: string };
      download: { value: number; source: string };
      upload: { value: number; source: string };
    }) => {
      // Проверяем, были ли результаты уже сохранены
      if (resultsSaved) {
        console.log("Результаты уже были сохранены, пропускаем");
        return;
      }

      console.log("Saving test results:", results);

      try {
        // Получаем информацию о сервере
        const serverInfoResponse = await fetch(
          "http://localhost:3001/speedtest/server-info"
        );
        const serverInfoData = await serverInfoResponse.json();
        const serverInfo = serverInfoData.servers[0];

        // Создаем данные для API, используя информацию о сервере и финальные результаты
        const bodyData = {
          downloadSpeed: results.download.value,
          uploadSpeed: results.upload.value,
          ping: results.ping.value,
          serverName: serverInfo.name,
          serverLocation: `${serverInfo.location.city || ""}, ${
            serverInfo.location.region || ""
          }, ${serverInfo.location.country || ""}`.replace(
            /^[, ]+|[, ]+$/g,
            ""
          ),
          userLocation: `${geolocationData?.city || ""}, ${
            geolocationData?.country || ""
          }`,
          isp: geolocationData?.org || serverInfo.location.org,
        };

        console.log("Данные для сохранения:", bodyData);

        const apiRequestBody = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bodyData),
        };

        console.log("Отправка результатов на сервер API напрямую...");

        // Отправляем запрос к API для сохранения
        const response = await fetch("/api/speedtest-direct", apiRequestBody);

        // Читаем ответ один раз и сохраняем как JSON
        const responseData = await response.json();
        console.log("Ответ от сервера:", responseData);

        if (!response.ok) {
          console.error("Ошибка при сохранении результатов:", responseData);
          console.error("Статус ответа:", response.status);

          // Если ошибка 401 - не авторизован, показываем сообщение и прекращаем попытки сохранения
          if (response.status === 401) {
            console.log(
              "Пользователь не авторизован. Результаты не будут сохранены."
            );
            // Здесь можно добавить уведомление для пользователя через UI
            // Например, использовать toast или alert из Mantine или другой библиотеки
            // toast({ title: "Авторизация требуется", description: "Войдите в систему, чтобы сохранить результаты" });
            return;
          }

          // Если прямой API недоступен, используем старый API
          console.log("Использование альтернативного метода сохранения...");

          // Подготавливаем данные для сохранения в старом формате
          const formData = new FormData();
          const dummyFile = new Blob([new ArrayBuffer(1024 * 1024)], {
            type: "application/octet-stream",
          });
          formData.append("files", dummyFile, "noiseData_1024.bin");

          // Собираем информацию о сервере в старом формате
          const serverInfoFallback = {
            name: "RychlostNet Combined",
            location: {
              city: libreSpeedResult?.server?.location?.city || "Unknown",
              region: libreSpeedResult?.server?.location?.region || "Unknown",
              country:
                libreSpeedResult?.server?.location?.country ||
                selectedServer?.location?.country ||
                "Unknown",
            },
            userLocation: {
              city: geolocationData?.city || "Unknown",
              region: "Unknown",
              country: geolocationData?.country || "Unknown",
              ip: geolocationData?.ip || "",
            },
            isp: geolocationData?.org || "Unknown",
          };

          formData.append("serverInfo", JSON.stringify(serverInfoFallback));

          // Добавляем данные теста для корректировки
          const cliTestData = {
            downloadSpeed: `${results.download.value.toFixed(2)} Mbps`,
            uploadSpeed: `${results.upload.value.toFixed(2)} Mbps`,
            ping: {
              min: 0,
              max: 0,
              avg: results.ping.value,
              jitter: 0,
            },
          };
          formData.append("cliTestData", JSON.stringify(cliTestData));

          // Отправляем запрос к старому API
          console.log("Отправка запроса к существующему API...");
          const fallbackResponse = await fetch("/api/speedtest", {
            method: "POST",
            body: formData,
          });

          if (fallbackResponse.ok) {
            const fallbackResponseData = await fallbackResponse.json();
            console.log(
              "Результаты успешно сохранены через fallback API:",
              fallbackResponseData
            );
          } else {
            const fallbackErrorText = await fallbackResponse.text();
            console.error(
              "Не удалось сохранить результаты через fallback API:",
              fallbackErrorText
            );
          }
        } else {
          console.log("Результаты успешно сохранены:", responseData);
        }

        // Отмечаем, что результаты были сохранены
        setResultsSaved(true);
      } catch (saveError) {
        console.error(
          "Ошибка при автоматическом сохранении результатов:",
          saveError
        );
      }
    },
    [geolocationData, libreSpeedResult, selectedServer, resultsSaved]
  );

  // Обработчик для получения финальных результатов из компонента CorrectedResults
  const handleResultsCalculated = useCallback(
    (results: {
      ping: { value: number; source: string };
      download: { value: number; source: string };
      upload: { value: number; source: string };
    }) => {
      console.log("Received final results:", results);
      setFinalResults(results);

      // Сразу сохраняем результаты без ожидания обновления состояния
      saveTestResults(results);
    },
    [saveTestResults]
  );

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
            hasAvailableServers={filteredServers.length > 0 && !checkingServers}
          />
        </Center>

        {checkingServers && (
          <Center>
            <Text size="xs" color="dimmed" mt="xs">
              Checking server availability...
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

      {/* Скрытый блок RychlostNet Test Results */}
      <Grid.Col span={12} style={{ display: "none" }}>
        <Card withBorder radius="md" className={classes.card}>
          <Group justify="space-between">
            <Text className={classes.title}>RychlostNet Test Results</Text>
          </Group>
          <SpeedTestResult networkStats={customSpeedStats} />
        </Card>
      </Grid.Col>

      {/* Скрытый блок LibreSpeed Test Results */}
      <Grid.Col span={12} style={{ display: "none" }}>
        <Card withBorder radius="md" className={classes.card}>
          <Group justify="space-between">
            <Text className={classes.title}>LibreSpeed Test Results</Text>
          </Group>
          <SpeedTestResult networkStats={networkStats} />
        </Card>
      </Grid.Col>

      {/* Скрытый блок Fast.com Test Results */}
      <Grid.Col span={12} style={{ display: "none" }}>
        <Card withBorder radius="md" className={classes.card}>
          <Group justify="space-between">
            <Text className={classes.title}>Fast.com Test Results</Text>
          </Group>
          <SpeedTestResult networkStats={fastSpeedStats} />
        </Card>
      </Grid.Col>

      {/* Отображаем компонент результатов всегда, даже в начале */}
      <Grid.Col span={12}>
        <CorrectedResults
          isTesting={isTesting}
          ownTestResult={
            downloadSpeed && uploadSpeed && pingStats.avg > 0
              ? {
                  download: Number(downloadSpeed.replace(" Mbps", "")),
                  upload: Number(uploadSpeed.replace(" Mbps", "")),
                  ping: pingStats,
                  jitter: pingStats.jitter,
                  ip: geolocationData?.ip || "",
                  server: selectedServer,
                  timestamp: new Date().toISOString(),
                }
              : null
          }
          libreSpeedResult={
            libreSpeedResult
              ? {
                  download: libreSpeedResult.download,
                  upload: libreSpeedResult.upload,
                  ping: {
                    min: libreSpeedResult.ping.min,
                    max: libreSpeedResult.ping.max,
                    avg: libreSpeedResult.ping.avg,
                    jitter: libreSpeedResult.jitter || 0,
                  },
                  jitter: libreSpeedResult.jitter || 0,
                  ip: libreSpeedResult.ip || "",
                  server: libreSpeedResult.server,
                  timestamp:
                    libreSpeedResult.timestamp || new Date().toISOString(),
                }
              : null
          }
          fastComResult={
            fastSpeedResult && fastPingStats.avg > 0
              ? {
                  download: fastSpeedResult,
                  upload: fastUploadSpeed
                    ? Number(fastUploadSpeed.replace(" Mbps", ""))
                    : 0,
                  ping: fastPingStats,
                  jitter: fastPingStats.jitter,
                  ip: geolocationData?.ip || "",
                  server: selectedServer,
                  timestamp: new Date().toISOString(),
                }
              : null
          }
          onResultsCalculated={handleResultsCalculated}
        />
      </Grid.Col>
    </Grid>
  );
};

export default function SpeedTest() {
  return (
    <ServerProvider>
      <SpeedTestContent />
    </ServerProvider>
  );
}
