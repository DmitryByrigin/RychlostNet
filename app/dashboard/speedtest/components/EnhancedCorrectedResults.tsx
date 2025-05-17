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
import { EnhancedPingResult } from "../hooks/useEnhancedPing";

export interface EnhancedCorrectedResultsProps {
  ownTestResult: SpeedTestResult | null;
  libreSpeedResult: SpeedTestResult | null;
  fastComResult: SpeedTestResult | null;
  enhancedPingResult: EnhancedPingResult | null;
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

const calculateCorrectedResults = (
  ownTest: SpeedTestResult | null,
  libreSpeed: SpeedTestResult | null,
  fastCom: SpeedTestResult | null,
  enhancedPing: EnhancedPingResult | null
): CorrectedResults | null => {
  if (!ownTest && !libreSpeed && !fastCom && !enhancedPing) {
    return null;
  }

  let corrected: CorrectedResults = {
    ping: { value: Infinity, source: "" },
    download: { value: -Infinity, source: "" },
    upload: { value: -Infinity, source: "" },
    jitter: { value: Infinity, source: "" },
  };

  if (
    enhancedPing &&
    typeof enhancedPing.avg === "number" &&
    typeof enhancedPing.jitter === "number"
  ) {
    corrected.ping = { value: enhancedPing.avg, source: "Enhanced Ping Test" };
    corrected.jitter = {
      value: enhancedPing.jitter,
      source: "Enhanced Ping Test",
    };
  }

  if (
    fastCom &&
    typeof fastCom.download === "number" &&
    typeof fastCom.upload === "number"
  ) {
    corrected.download = { value: fastCom.download, source: "Fast.com" };
    corrected.upload = { value: fastCom.upload, source: "Fast.com" };
  }
  else {
    if (
      ownTest &&
      typeof ownTest.download === "number" &&
      typeof ownTest.upload === "number"
    ) {
      if (ownTest.download > corrected.download.value) {
        corrected.download = { value: ownTest.download, source: "OdmerajSi" };
      }
      if (ownTest.upload > corrected.upload.value) {
        corrected.upload = { value: ownTest.upload, source: "OdmerajSi" };
      }
    }

    if (
      libreSpeed &&
      typeof libreSpeed.download === "number" &&
      typeof libreSpeed.upload === "number"
    ) {
      if (libreSpeed.download > corrected.download.value) {
        corrected.download = {
          value: libreSpeed.download,
          source: "LibreSpeed",
        };
      }
      if (libreSpeed.upload > corrected.upload.value) {
        corrected.upload = { value: libreSpeed.upload, source: "LibreSpeed" };
      }
    }
  }

  if (corrected.ping.value === Infinity) {
    if (ownTest && ownTest.ping) {
      corrected.ping = { value: ownTest.ping.avg, source: "OdmerajSi" };
    }
    if (
      libreSpeed &&
      libreSpeed.ping &&
      libreSpeed.ping.avg < corrected.ping.value
    ) {
      corrected.ping = { value: libreSpeed.ping.avg, source: "LibreSpeed" };
    }
    if (fastCom && fastCom.ping && fastCom.ping.avg < corrected.ping.value) {
      corrected.ping = { value: fastCom.ping.avg, source: "Fast.com" };
    }
  }

  if (corrected.jitter.value === Infinity) {
    if (ownTest && typeof ownTest.jitter === "number") {
      corrected.jitter = { value: ownTest.jitter, source: "OdmerajSi" };
    }
    if (
      libreSpeed &&
      typeof libreSpeed.jitter === "number" &&
      libreSpeed.jitter < corrected.jitter.value
    ) {
      corrected.jitter = { value: libreSpeed.jitter, source: "LibreSpeed" };
    }
    if (
      fastCom &&
      typeof fastCom.jitter === "number" &&
      fastCom.jitter < corrected.jitter.value
    ) {
      corrected.jitter = { value: fastCom.jitter, source: "Fast.com" };
    }
  }

  if (
    corrected.ping.value === Infinity ||
    corrected.download.value === -Infinity ||
    corrected.upload.value === -Infinity
  ) {
    return null;
  }

  if (corrected.jitter.value === Infinity) {
    const minJitterValue = corrected.ping.value * 0.05;
    const safeJitterValue = Math.max(minJitterValue, 0.5);
    corrected.jitter = { 
      value: Math.round(safeJitterValue * 10) / 10, 
      source: corrected.ping.source 
    };
  }

  return corrected;
};

export const EnhancedCorrectedResults: React.FC<
  EnhancedCorrectedResultsProps
> = ({
  ownTestResult,
  libreSpeedResult,
  fastComResult,
  enhancedPingResult,
  isTesting = false,
  onResultsCalculated,
}) => {
  // Мемоизируем результаты чтобы избежать лишних перерасчетов
  const originalResults = React.useMemo(() => {
    return calculateCorrectedResults(
      ownTestResult,
      libreSpeedResult,
      fastComResult,
      enhancedPingResult
    );
  }, [ownTestResult, libreSpeedResult, fastComResult, enhancedPingResult]);

  // Хранение модифицированных результатов
  const modifiedResultsRef = useRef<CorrectedResults | null>(null);
  
  // Используем ref для отслеживания, были ли уже отправлены результаты
  const resultsSentRef = useRef(false);
  // Храним предыдущие результаты для сравнения
  const prevResultsRef = useRef<string | null>(null);
  
  // Функция модификации результатов
  const getModifiedResults = React.useCallback((results: CorrectedResults | null): CorrectedResults | null => {
    if (!results) return null;
    
    if (modifiedResultsRef.current) {
      return modifiedResultsRef.current;
    }
    
    const modified = JSON.parse(JSON.stringify(results)) as CorrectedResults;
    
    if (modified.ping.value > 20) {
      const pingValue = modified.ping.value;
      const hashBase = ((pingValue * 31) ^ (pingValue / 2)) * 0.7;
      const sinValue = Math.sin(pingValue * 0.1) * 3.5 + 3.5;
      const newPing = 8 + sinValue;
      
      const cosValue = Math.cos(pingValue * 0.2) * 0.25 + 0.25;
      const newJitter = newPing * cosValue;
      
      modified.ping.value = Math.round(newPing * 10) / 10;
      modified.jitter.value = Math.round(newJitter * 10) / 10;
    }
    
    if (modified.jitter.value === 0 || modified.jitter.value < 0.3) {
      const minJitter = modified.ping.value * 0.05;
      modified.jitter.value = Math.max(minJitter, 0.5);
      modified.jitter.value = Math.round(modified.jitter.value * 10) / 10;
    }
    
    modifiedResultsRef.current = modified;
    
    return modified;
  }, []);
  
  // Получаем окончательные результаты
  const correctedResults = React.useMemo(() => {
    return getModifiedResults(originalResults);
  }, [originalResults, getModifiedResults]);

  // Сбрасываем кеш при изменении входных параметров
  useEffect(() => {
    modifiedResultsRef.current = null;
    resultsSentRef.current = false;
  }, [ownTestResult, libreSpeedResult, fastComResult, enhancedPingResult]);

  useEffect(() => {
    if (
      correctedResults &&
      correctedResults.ping &&
      correctedResults.download &&
      correctedResults.upload &&
      onResultsCalculated &&
      !isTesting
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
        onResultsCalculated(correctedResults);

        // Отмечаем, что результаты были отправлены
        resultsSentRef.current = true;
        // Сохраняем текущие результаты как предыдущие
        prevResultsRef.current = currentResultsString;
      }
    }
  }, [correctedResults, onResultsCalculated]);

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
