import React, { useEffect, useRef } from "react";
import { Card, Text, Stack, Group } from "@mantine/core";
import { SpeedTestResult } from "../hooks/utils/types";

export interface CorrectedResultsProps {
  ownTestResult: SpeedTestResult | null;
  libreSpeedResult: SpeedTestResult | null;
  fastComResult: SpeedTestResult | null;
  isTesting?: boolean;
  onResultsCalculated?: (results: {
    ping: { value: number; source: string };
    download: { value: number; source: string };
    upload: { value: number; source: string };
  }) => void;
}

interface CorrectedValue {
  value: number;
  source: string;
}

interface CorrectedResults {
  ping: CorrectedValue;
  download: CorrectedValue;
  upload: CorrectedValue;
}

interface UserLocation {
  city: string;
  region: string;
  country: string;
  ip?: string;
}

const calculateCorrectedResults = (
  ownTest: SpeedTestResult | null,
  libreSpeed: SpeedTestResult | null,
  fastCom: SpeedTestResult | null
): CorrectedResults | null => {
  // Если нет ни одного результата, возвращаем null
  if (!ownTest && !libreSpeed && !fastCom) {
    return null;
  }

  // Инициализируем результаты первым доступным тестом
  let corrected: CorrectedResults = {
    ping: { value: Infinity, source: "" },
    download: { value: -Infinity, source: "" },
    upload: { value: -Infinity, source: "" },
  };

  // Проверяем результаты собственного теста
  if (
    ownTest &&
    ownTest.ping &&
    typeof ownTest.download === "number" &&
    typeof ownTest.upload === "number"
  ) {
    if (ownTest.ping.avg < corrected.ping.value) {
      corrected.ping = { value: ownTest.ping.avg, source: "RychlostNet" };
    }
    if (ownTest.download > corrected.download.value) {
      corrected.download = { value: ownTest.download, source: "RychlostNet" };
    }
    if (ownTest.upload > corrected.upload.value) {
      corrected.upload = { value: ownTest.upload, source: "RychlostNet" };
    }
  }

  // Проверяем результаты LibreSpeed
  if (
    libreSpeed &&
    libreSpeed.ping &&
    typeof libreSpeed.download === "number" &&
    typeof libreSpeed.upload === "number"
  ) {
    if (libreSpeed.ping.avg < corrected.ping.value) {
      corrected.ping = { value: libreSpeed.ping.avg, source: "LibreSpeed" };
    }
    if (libreSpeed.download > corrected.download.value) {
      corrected.download = { value: libreSpeed.download, source: "LibreSpeed" };
    }
    if (libreSpeed.upload > corrected.upload.value) {
      corrected.upload = { value: libreSpeed.upload, source: "LibreSpeed" };
    }
  }

  // Проверяем результаты Fast.com
  if (
    fastCom &&
    fastCom.ping &&
    typeof fastCom.download === "number" &&
    typeof fastCom.upload === "number"
  ) {
    if (fastCom.ping.avg < corrected.ping.value) {
      corrected.ping = { value: fastCom.ping.avg, source: "Fast.com" };
    }
    if (fastCom.download > corrected.download.value) {
      corrected.download = { value: fastCom.download, source: "Fast.com" };
    }
    if (fastCom.upload > corrected.upload.value) {
      corrected.upload = { value: fastCom.upload, source: "Fast.com" };
    }
  }

  // Проверяем, что у нас есть хотя бы один валидный результат
  if (
    corrected.ping.value === Infinity ||
    corrected.download.value === -Infinity ||
    corrected.upload.value === -Infinity
  ) {
    return null;
  }

  return corrected;
};

export const CorrectedResults: React.FC<CorrectedResultsProps> = ({
  ownTestResult,
  libreSpeedResult,
  fastComResult,
  isTesting = false,
  onResultsCalculated,
}) => {
  const correctedResults = calculateCorrectedResults(
    ownTestResult,
    libreSpeedResult,
    fastComResult
  );

  // Используем ref для отслеживания, были ли уже отправлены результаты
  const resultsSentRef = useRef(false);
  // Храним предыдущие результаты для сравнения
  const prevResultsRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      correctedResults &&
      correctedResults.ping &&
      correctedResults.download &&
      correctedResults.upload &&
      onResultsCalculated
    ) {
      // Преобразуем текущие результаты в строку для сравнения
      const currentResultsString = JSON.stringify({
        ping: correctedResults.ping.value,
        download: correctedResults.download.value,
        upload: correctedResults.upload.value,
      });

      // Проверяем, отличаются ли текущие результаты от предыдущих
      // и не были ли они уже отправлены
      if (
        currentResultsString !== prevResultsRef.current &&
        !resultsSentRef.current
      ) {
        console.log("Displaying results: ", correctedResults);
        onResultsCalculated(correctedResults);

        // Отмечаем, что результаты были отправлены
        resultsSentRef.current = true;
        // Сохраняем текущие результаты как предыдущие
        prevResultsRef.current = currentResultsString;
      }
    }
  }, [correctedResults, onResultsCalculated]);

  // Сбрасываем флаг при изменении входных параметров
  useEffect(() => {
    resultsSentRef.current = false;
  }, [ownTestResult, libreSpeedResult, fastComResult]);

  if (!correctedResults || isTesting) {
    return (
      <Card
        withBorder
        radius="md"
        style={{ marginBottom: "1rem", backgroundColor: "#1a237e" }}
      >
        <Stack>
          <Text fw={500} size="xl" c="white">
            📊 Speed Test Results
          </Text>
          <Stack gap="xs">
            <Group>
              <Text c="white">
                ⚡ Ping: {isTesting ? "Measuring..." : "-- ms"}
              </Text>
            </Group>
            <Group>
              <Text c="white">
                ⬇️ Download: {isTesting ? "Measuring..." : "-- Mbps"}
              </Text>
            </Group>
            <Group>
              <Text c="white">
                ⬆️ Upload: {isTesting ? "Measuring..." : "-- Mbps"}
              </Text>
            </Group>
          </Stack>
        </Stack>
      </Card>
    );
  }

  // Показываем информацию, что результаты автоматически сохраняются
  console.log("Displaying results:", correctedResults);

  return (
    <Card
      withBorder
      radius="md"
      style={{ marginBottom: "1rem", backgroundColor: "#1a237e" }}
    >
      <Stack>
        <Text fw={500} size="xl" c="white">
          📊 Speed Test Results
        </Text>
        <Stack gap="xs">
          <Group>
            <Text c="white">
              ⚡ Ping: {correctedResults.ping.value.toFixed(2)} ms
            </Text>
          </Group>

          <Group>
            <Text c="white">
              ⬇️ Download: {correctedResults.download.value.toFixed(2)} Mbps
            </Text>
          </Group>

          <Group>
            <Text c="white">
              ⬆️ Upload: {correctedResults.upload.value.toFixed(2)} Mbps
            </Text>
          </Group>
        </Stack>
      </Stack>
    </Card>
  );
};
