import React, { useEffect, useRef } from "react";
import { Card, Text, SimpleGrid, Group } from "@mantine/core";
import { SpeedTestResult } from "../hooks/utils/types";
import classes from "../SpeedTest.module.css";
import { StatItem } from "./StatItem";
import { NetworkStat } from "../types/speedTest";
import {
  IconArrowsDiff,
  IconDownload,
  IconUpload,
  IconWaveSine,
} from "@tabler/icons-react";

export interface CorrectedResultsProps {
  ownTestResult: SpeedTestResult | null;
  libreSpeedResult: SpeedTestResult | null;
  fastComResult: SpeedTestResult | null;
  isTesting?: boolean;
  onResultsCalculated?: (results: {
    ping: { value: number; source: string };
    download: { value: number; source: string };
    upload: { value: number; source: string };
    jitter: { value: number; source: string };
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
  jitter: CorrectedValue;
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
    jitter: { value: Infinity, source: "" },
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
    if (ownTest.jitter < corrected.jitter.value) {
      corrected.jitter = { value: ownTest.jitter, source: "RychlostNet" };
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
    if (libreSpeed.jitter && libreSpeed.jitter < corrected.jitter.value) {
      corrected.jitter = { value: libreSpeed.jitter, source: "LibreSpeed" };
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
    if (fastCom.jitter && fastCom.jitter < corrected.jitter.value) {
      corrected.jitter = { value: fastCom.jitter, source: "Fast.com" };
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

  // Если нет валидного джиттера, установим значение 0
  if (corrected.jitter.value === Infinity) {
    corrected.jitter = { value: 0, source: corrected.ping.source };
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
        jitter: correctedResults.jitter.value,
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

  // Создаем массив статистики для отображения в компоненте StatItem
  const getResultStats = (): NetworkStat[] => {
    if (!correctedResults || isTesting) {
      return [
        {
          key: "Ping",
          value: isTesting ? "Measuring..." : "",
          icon: IconArrowsDiff,
        },
        {
          key: "Download",
          value: isTesting ? "Measuring..." : "",
          icon: IconDownload,
        },
        {
          key: "Upload",
          value: isTesting ? "Measuring..." : "",
          icon: IconUpload,
        },
        {
          key: "Jitter",
          value: isTesting ? "Measuring..." : "",
          icon: IconWaveSine,
        },
      ];
    }

    return [
      {
        key: "Ping",
        value: `${correctedResults.ping.value.toFixed(2)} ms`,
        icon: IconArrowsDiff,
      },
      {
        key: "Download",
        value: `${correctedResults.download.value.toFixed(2)} Mbps`,
        icon: IconDownload,
      },
      {
        key: "Upload",
        value: `${correctedResults.upload.value.toFixed(2)} Mbps`,
        icon: IconUpload,
      },
      {
        key: "Jitter",
        value: `${correctedResults.jitter.value.toFixed(2)} ms`,
        icon: IconWaveSine,
      },
    ];
  };

  const networkStats = getResultStats();

  return (
    <Card withBorder radius="md" className={classes.card} mb="md">
      <Group justify="space-between">
        <Text className={classes.title}>Speed Test Results</Text>
      </Group>
      <SimpleGrid className={classes.resultCols} mt="md">
        {networkStats.map((stat) => {
          const { key, ...rest } = stat;
          return <StatItem key={key} statKey={key} {...rest} />;
        })}
      </SimpleGrid>
    </Card>
  );
};
