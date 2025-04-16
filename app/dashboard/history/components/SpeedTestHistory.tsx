import React, { useEffect, useState } from "react";
import {
  ActionIcon,
  Button,
  Center,
  Loader,
  ScrollArea,
  Table,
  Stack,
  Text,
  ThemeIcon,
  Badge,
  Tooltip,
} from "@mantine/core";
import {
  IconSortAscending,
  IconSortDescending,
  IconTrash,
  IconHistory,
  IconUserCircle,
} from "@tabler/icons-react";
import classes from "../SpeedTestHistory.module.css";
import { notifications } from "@mantine/notifications";
import { useCurrentUser } from "@/hooks/use-current-user";

interface UserInfo {
  id: string;
  name: string | null;
  email: string | null;
}

interface SpeedTestHistoryType {
  id: string;
  timestamp: Date;
  downloadSpeed: number;
  uploadSpeed: number;
  ping: number;
  jitter: number;
  userLocation: string | null;
  isp: string | null;
  serverName: string | null;
  serverLocation: string | null;
  userId: string | null;
  user?: UserInfo;
}

const SpeedTestHistoryComponent: React.FC = () => {
  const user = useCurrentUser();
  const [data, setData] = useState<SpeedTestHistoryType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [sortColumn, setSortColumn] = useState<
    keyof SpeedTestHistoryType | null
  >(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (user) {
      const userIsAdmin = user.role === "ADMIN";
      setIsAdmin(userIsAdmin);
      console.log("User role from session:", {
        isAdmin: userIsAdmin,
        role: user.role,
        name: user.name,
      });
    }
  }, [user]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/speedtest?userOnly=true");

        if (!response.ok) {
          if (response.status === 401) {
            setError("Please log in to view your test history");
          } else {
            throw new Error("Failed to fetch history");
          }
          return;
        }

        const data = await response.json();
        const formattedData = data.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));

        console.log("History data:", formattedData);

        setData(formattedData);
      } catch (error) {
        console.error("Error fetching history:", error);
        setError(
          error instanceof Error ? error.message : "Failed to load history"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const handleSort = (column: keyof SpeedTestHistoryType) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Оптимистично обновляем UI перед отправкой запроса
      const updatedData = data.filter((test) => test.id !== id);
      setData(updatedData);

      // Показываем уведомление об удалении (можно добавить индикатор загрузки)
      const notification = notifications.show({
        id: `delete-${id}`,
        title: "Удаление...",
        message: "Удаление записи",
        color: "blue",
        loading: true,
        autoClose: false,
      });

      // Отправляем запрос на удаление
      const response = await fetch(`/api/speedtest/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // В случае ошибки восстанавливаем данные
        setData(data);
        throw new Error("Failed to delete test");
      }

      // Обновляем уведомление при успешном удалении
      notifications.update({
        id: `delete-${id}`,
        title: "Успешно",
        message: "Запись удалена",
        color: "green",
        loading: false,
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Error deleting test:", error);

      // Показываем уведомление об ошибке
      notifications.show({
        title: "Ошибка",
        message:
          error instanceof Error ? error.message : "Failed to delete test",
        color: "red",
      });
    }
  };

  const handleDeleteAll = async () => {
    try {
      // Оптимистично обновляем UI перед отправкой запроса
      const oldData = [...data];
      setData([]);

      // Показываем уведомление об удалении
      const notification = notifications.show({
        id: "delete-all",
        title: "Удаление...",
        message: "Удаление всех записей",
        color: "blue",
        loading: true,
        autoClose: false,
      });

      const response = await fetch("/api/speedtest", {
        method: "DELETE",
      });

      if (!response.ok) {
        // В случае ошибки восстанавливаем данные
        setData(oldData);
        throw new Error("Failed to delete all tests");
      }

      // Обновляем уведомление при успешном удалении
      notifications.update({
        id: "delete-all",
        title: "Успешно",
        message: "Все записи удалены",
        color: "green",
        loading: false,
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Error deleting all tests:", error);

      // Показываем уведомление об ошибке
      notifications.show({
        title: "Ошибка",
        message:
          error instanceof Error ? error.message : "Failed to delete all tests",
        color: "red",
      });
    }
  };

  const formatSpeed = (speed: number) => `${speed.toFixed(2)} Mbps`;
  const formatPing = (ping: number) => `${ping.toFixed(2)} ms`;
  const formatDate = (date: Date) => date.toLocaleString();

  if (loading) {
    return (
      <Center style={{ height: "calc(100vh - 200px)", width: "100%" }}>
        <Loader color="indigo" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center style={{ height: "calc(100vh - 200px)", width: "100%" }}>
        <Stack align="center">
          <ThemeIcon size={48} radius="xl" color="gray.3">
            <IconHistory size={24} stroke={1.5} />
          </ThemeIcon>
          <Text size="lg" style={{ fontWeight: "bold" }}>
            Error Loading History
          </Text>
          <Text size="sm" style={{ textAlign: "center" }}>
            {error}
          </Text>
        </Stack>
      </Center>
    );
  }

  if (data.length === 0) {
    return (
      <Center style={{ height: "calc(100vh - 200px)", width: "100%" }}>
        <Stack align="center">
          <ThemeIcon size={48} radius="xl" color="gray.3">
            <IconHistory size={24} stroke={1.5} />
          </ThemeIcon>
          <Text size="lg" style={{ fontWeight: "bold" }}>
            No Test History
          </Text>
          <Text size="sm" style={{ textAlign: "center" }}>
            {isAdmin
              ? "No speed test results have been recorded yet."
              : "Your speed test history will appear here after you complete your first test."}
          </Text>
        </Stack>
      </Center>
    );
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0;

    const aValue = sortColumn in a ? a[sortColumn] : undefined;
    const bValue = sortColumn in b ? b[sortColumn] : undefined;

    if (
      aValue === null ||
      aValue === undefined ||
      bValue === null ||
      bValue === undefined
    )
      return 0;

    if (sortColumn === "timestamp") {
      return sortDirection === "asc"
        ? a.timestamp.getTime() - b.timestamp.getTime()
        : b.timestamp.getTime() - a.timestamp.getTime();
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <>
      {data.length > 1 && (
        <Button color="red" onClick={handleDeleteAll} mb="md">
          Delete All
        </Button>
      )}
      <ScrollArea>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th
                onClick={() => handleSort("timestamp")}
                className={classes.sortableHeader}
              >
                Timestamp{" "}
                {sortColumn === "timestamp" &&
                  (sortDirection === "asc" ? (
                    <IconSortAscending size={16} />
                  ) : (
                    <IconSortDescending size={16} />
                  ))}
              </Table.Th>
              {isAdmin && <Table.Th>User</Table.Th>}
              <Table.Th
                onClick={() => handleSort("downloadSpeed")}
                className={classes.sortableHeader}
              >
                Download Speed (Mbps){" "}
                {sortColumn === "downloadSpeed" &&
                  (sortDirection === "asc" ? (
                    <IconSortAscending size={16} />
                  ) : (
                    <IconSortDescending size={16} />
                  ))}
              </Table.Th>
              <Table.Th
                onClick={() => handleSort("uploadSpeed")}
                className={classes.sortableHeader}
              >
                Upload Speed (Mbps){" "}
                {sortColumn === "uploadSpeed" &&
                  (sortDirection === "asc" ? (
                    <IconSortAscending size={16} />
                  ) : (
                    <IconSortDescending size={16} />
                  ))}
              </Table.Th>
              <Table.Th
                onClick={() => handleSort("ping")}
                className={classes.sortableHeader}
              >
                Ping (ms){" "}
                {sortColumn === "ping" &&
                  (sortDirection === "asc" ? (
                    <IconSortAscending size={16} />
                  ) : (
                    <IconSortDescending size={16} />
                  ))}
              </Table.Th>
              <Table.Th
                onClick={() => handleSort("jitter")}
                className={classes.sortableHeader}
              >
                Jitter (ms){" "}
                {sortColumn === "jitter" &&
                  (sortDirection === "asc" ? (
                    <IconSortAscending size={16} />
                  ) : (
                    <IconSortDescending size={16} />
                  ))}
              </Table.Th>
              <Table.Th
                onClick={() => handleSort("userLocation")}
                className={classes.sortableHeader}
              >
                User Location{" "}
                {sortColumn === "userLocation" &&
                  (sortDirection === "asc" ? (
                    <IconSortAscending size={16} />
                  ) : (
                    <IconSortDescending size={16} />
                  ))}
              </Table.Th>
              <Table.Th
                onClick={() => handleSort("serverName")}
                className={classes.sortableHeader}
              >
                Server Name{" "}
                {sortColumn === "serverName" &&
                  (sortDirection === "asc" ? (
                    <IconSortAscending size={16} />
                  ) : (
                    <IconSortDescending size={16} />
                  ))}
              </Table.Th>
              <Table.Th
                onClick={() => handleSort("serverLocation")}
                className={classes.sortableHeader}
              >
                Server Location{" "}
                {sortColumn === "serverLocation" &&
                  (sortDirection === "asc" ? (
                    <IconSortAscending size={16} />
                  ) : (
                    <IconSortDescending size={16} />
                  ))}
              </Table.Th>
              <Table.Th
                onClick={() => handleSort("isp")}
                className={classes.sortableHeader}
              >
                ISP{" "}
                {sortColumn === "isp" &&
                  (sortDirection === "asc" ? (
                    <IconSortAscending size={16} />
                  ) : (
                    <IconSortDescending size={16} />
                  ))}
              </Table.Th>
              <Table.Th>
                <Center>Actions</Center>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedData.map((test) => (
              <Table.Tr key={test.id}>
                <Table.Td>{formatDate(test.timestamp)}</Table.Td>
                {isAdmin && (
                  <Table.Td>
                    {test.user ? (
                      <Tooltip label={test.user.email || "No email"}>
                        <Badge
                          leftSection={<IconUserCircle size={14} />}
                          color="blue"
                        >
                          {test.user.name || test.user.email || "Unknown User"}
                        </Badge>
                      </Tooltip>
                    ) : (
                      <Badge color="gray">Guest User</Badge>
                    )}
                  </Table.Td>
                )}
                <Table.Td>{formatSpeed(test.downloadSpeed)}</Table.Td>
                <Table.Td>{formatSpeed(test.uploadSpeed)}</Table.Td>
                <Table.Td>{formatPing(test.ping)}</Table.Td>
                <Table.Td>
                  {test.jitter ? formatPing(test.jitter) : "N/A"}
                </Table.Td>
                <Table.Td>{test.userLocation || "Unknown"}</Table.Td>
                <Table.Td>{test.serverName || "Unknown"}</Table.Td>
                <Table.Td>{test.serverLocation || "Unknown"}</Table.Td>
                <Table.Td>{test.isp || "Unknown"}</Table.Td>
                <Table.Td>
                  <Center>
                    <ActionIcon
                      color="red"
                      onClick={() => handleDelete(test.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Center>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </>
  );
};

export default SpeedTestHistoryComponent;
