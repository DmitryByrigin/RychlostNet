"use client";

import { useEffect, useState } from "react";
import {
  Container,
  Title,
  Text,
  Loader,
  Center,
  Paper,
  Group,
  Badge,
  Table,
  ScrollArea,
  ActionIcon,
  Stack,
  Select,
  TextInput,
  Button,
  Grid,
  Box,
  Alert,
} from "@mantine/core";
import {
  IconUser,
  IconTrash,
  IconFilter,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconAlertCircle,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useDebouncedValue } from "@mantine/hooks";
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
  provider?: string | null;
  testType?: string | null;
}

export default function AdminSpeedTests() {
  const user = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<SpeedTestHistoryType[]>([]);
  const [filteredTests, setFilteredTests] = useState<SpeedTestHistoryType[]>(
    []
  );
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Фильтры
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery] = useDebouncedValue(searchQuery, 300);
  const [filterUser, setFilterUser] = useState<string | null>(null);
  const [filterISP, setFilterISP] = useState<string | null>(null);
  const [filterServer, setFilterServer] = useState<string | null>(null);

  // Сортировка
  const [sortField, setSortField] =
    useState<keyof SpeedTestHistoryType>("timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Список уникальных значений для фильтров
  const [uniqueUsers, setUniqueUsers] = useState<
    { value: string; label: string }[]
  >([]);
  const [uniqueISPs, setUniqueISPs] = useState<
    { value: string; label: string }[]
  >([]);
  const [uniqueServers, setUniqueServers] = useState<
    { value: string; label: string }[]
  >([]);

  // Определяем роль администратора на основе данных пользователя из сессии
  useEffect(() => {
    if (user) {
      const userIsAdmin = user.role === "ADMIN";
      setIsAdmin(userIsAdmin);
      console.log("User role from session:", {
        isAdmin: userIsAdmin,
        role: user.role,
        name: user.name,
      });

      if (!userIsAdmin) {
        setError("You don't have enough permissions to access this page");
        setLoading(false);
      }
    } else {
      setError("Authorization required to access this page");
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Загружаем данные только если пользователь - администратор
    if (user && user.role === "ADMIN") {
      const fetchData = async () => {
        try {
          setLoading(true);
          const response = await fetch("/api/speedtest");

          if (response.status === 401) {
            setError("Authorization required to access this page");
            setLoading(false);
            return;
          }

          if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
          }

          const data = await response.json();

          // Больше не проверяем здесь роль администратора
          // const hasUserInfo = data.some((item: any) => item.user);
          // if (!hasUserInfo) {
          //   setError("У вас недостаточно прав для доступа к этой странице");
          //   setLoading(false);
          //   return;
          // }
          // setIsAdmin(true);

          // Форматируем данные, преобразуя строки дат в объекты Date
          const formattedData = data.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }));

          setTests(formattedData);
          setFilteredTests(formattedData);

          // Формируем уникальные списки для фильтров
          const users = Array.from(
            new Set(
              formattedData
                .filter((test: any) => test.user)
                .map((test: any) => test.user?.id)
            )
          ).map((userId) => {
            const user = formattedData.find(
              (test: any) => test.user?.id === userId
            )?.user;
            return {
              value: userId as string,
              label: (user?.name ||
                user?.email ||
                "User without name") as string,
            };
          });
          setUniqueUsers(users);

          const isps = Array.from(
            new Set(
              formattedData
                .filter((test: any) => test.isp)
                .map((test: any) => test.isp)
            )
          ).map((isp) => ({ value: isp as string, label: isp as string }));
          setUniqueISPs(isps);

          const servers = Array.from(
            new Set(
              formattedData
                .filter((test: any) => test.serverName)
                .map((test: any) => test.serverName)
            )
          ).map((server) => ({
            value: server as string,
            label: server as string,
          }));
          setUniqueServers(servers);
        } catch (err) {
          console.error("Error loading data:", err);
          setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [user]);

  // Применяем фильтры при изменении условий
  useEffect(() => {
    if (!tests.length) return;

    let filtered = [...tests];

    // Поиск по текстовому запросу
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (test) =>
          test.user?.name?.toLowerCase().includes(query) ||
          test.user?.email?.toLowerCase().includes(query) ||
          test.userLocation?.toLowerCase().includes(query) ||
          test.serverName?.toLowerCase().includes(query) ||
          test.isp?.toLowerCase().includes(query)
      );
    }

    // Фильтр по пользователю
    if (filterUser) {
      filtered = filtered.filter((test) => test.user?.id === filterUser);
    }

    // Фильтр по провайдеру (ISP)
    if (filterISP) {
      filtered = filtered.filter((test) => test.isp === filterISP);
    }

    // Фильтр по серверу
    if (filterServer) {
      filtered = filtered.filter((test) => test.serverName === filterServer);
    }

    // Сортировка
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Обработка null и undefined
      if (aValue === null || aValue === undefined)
        return sortDirection === "asc" ? -1 : 1;
      if (bValue === null || bValue === undefined)
        return sortDirection === "asc" ? 1 : -1;

      // Обработка дат
      if (sortField === "timestamp") {
        const aTime = (aValue as Date).getTime();
        const bTime = (bValue as Date).getTime();
        return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
      }

      // Обработка строк
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Обработка чисел
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    setFilteredTests(filtered);
  }, [
    tests,
    debouncedSearchQuery,
    filterUser,
    filterISP,
    filterServer,
    sortField,
    sortDirection,
  ]);

  const handleDelete = async (id: string) => {
    try {
      // Оптимистично обновляем UI перед отправкой запроса
      const updatedTests = tests.filter((test) => test.id !== id);
      const updatedFilteredTests = filteredTests.filter(
        (test) => test.id !== id
      );
      setTests(updatedTests);
      setFilteredTests(updatedFilteredTests);

      // Показываем уведомление об удалении (с индикатором загрузки)
      const notification = notifications.show({
        id: `delete-${id}`,
        title: "Deleting...",
        message: "Deleting record",
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
        setTests(tests);
        setFilteredTests(filteredTests);
        throw new Error("Failed to delete record");
      }

      // Обновляем уведомление при успешном удалении
      notifications.update({
        id: `delete-${id}`,
        title: "Success",
        message: "Test record deleted",
        color: "green",
        loading: false,
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Error deleting:", error);
      notifications.show({
        title: "Error",
        message:
          error instanceof Error ? error.message : "Failed to delete record",
        color: "red",
      });
    }
  };

  const handleSort = (field: keyof SpeedTestHistoryType) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setFilterUser(null);
    setFilterISP(null);
    setFilterServer(null);
  };

  // Форматирование данных для отображения
  const formatDate = (date: Date) => date.toLocaleString();
  const formatSpeed = (speed: number) => `${speed.toFixed(2)} Mbps`;
  const formatPing = (ping: number) => `${ping.toFixed(2)} ms`;

  if (loading) {
    return (
      <Center style={{ height: "100vh" }}>
        <Loader size="xl" />
      </Center>
    );
  }

  if (error) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error}
        </Alert>
      </Container>
    );
  }

  if (!isAdmin) {
    return (
      <Container size="lg" py="xl">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Access Denied"
          color="red"
        >
          You don't have access rights to this page. Only administrators can
          view this page.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="md">
        Speed Test Results
      </Title>
      <Text mb="xl" c="dimmed">
        Admin panel for viewing all speed test results
      </Text>

      <Paper p="md" mb="lg" withBorder>
        <Stack>
          <Text fw={500}>Filters</Text>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <TextInput
                placeholder="Search..."
                leftSection={<IconSearch size="1rem" />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                aria-label="Search"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 2.66 }}>
              <Select
                placeholder="User"
                leftSection={<IconUser size="1rem" />}
                data={uniqueUsers}
                value={filterUser}
                onChange={setFilterUser}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 2.66 }}>
              <Select
                placeholder="ISP"
                leftSection={<IconFilter size="1rem" />}
                data={uniqueISPs}
                value={filterISP}
                onChange={setFilterISP}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 2.66 }}>
              <Select
                placeholder="Server"
                leftSection={<IconFilter size="1rem" />}
                data={uniqueServers}
                value={filterServer}
                onChange={setFilterServer}
                clearable
              />
            </Grid.Col>
          </Grid>
          <Group justify="right">
            <Button variant="outline" onClick={resetFilters}>
              Reset Filters
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Box mb="md">
          <Text size="sm" fw={500}>
            Records found: {filteredTests.length}
          </Text>
        </Box>
        <ScrollArea h={600}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th
                  onClick={() => handleSort("timestamp")}
                  style={{ cursor: "pointer" }}
                >
                  <Group gap={4}>
                    Test Time
                    {sortField === "timestamp" &&
                      (sortDirection === "asc" ? (
                        <IconSortAscending size={16} />
                      ) : (
                        <IconSortDescending size={16} />
                      ))}
                  </Group>
                </Table.Th>
                <Table.Th
                  onClick={() => handleSort("user")}
                  style={{ cursor: "pointer" }}
                >
                  <Group gap={4}>
                    User
                    {sortField === "user" &&
                      (sortDirection === "asc" ? (
                        <IconSortAscending size={16} />
                      ) : (
                        <IconSortDescending size={16} />
                      ))}
                  </Group>
                </Table.Th>
                <Table.Th
                  onClick={() => handleSort("downloadSpeed")}
                  style={{ cursor: "pointer" }}
                >
                  <Group gap={4}>
                    Download
                    {sortField === "downloadSpeed" &&
                      (sortDirection === "asc" ? (
                        <IconSortAscending size={16} />
                      ) : (
                        <IconSortDescending size={16} />
                      ))}
                  </Group>
                </Table.Th>
                <Table.Th
                  onClick={() => handleSort("uploadSpeed")}
                  style={{ cursor: "pointer" }}
                >
                  <Group gap={4}>
                    Upload
                    {sortField === "uploadSpeed" &&
                      (sortDirection === "asc" ? (
                        <IconSortAscending size={16} />
                      ) : (
                        <IconSortDescending size={16} />
                      ))}
                  </Group>
                </Table.Th>
                <Table.Th
                  onClick={() => handleSort("ping")}
                  style={{ cursor: "pointer" }}
                >
                  <Group gap={4}>
                    Ping
                    {sortField === "ping" &&
                      (sortDirection === "asc" ? (
                        <IconSortAscending size={16} />
                      ) : (
                        <IconSortDescending size={16} />
                      ))}
                  </Group>
                </Table.Th>
                <Table.Th
                  onClick={() => handleSort("jitter")}
                  style={{ cursor: "pointer" }}
                >
                  <Group gap={4}>
                    Jitter
                    {sortField === "jitter" &&
                      (sortDirection === "asc" ? (
                        <IconSortAscending size={16} />
                      ) : (
                        <IconSortDescending size={16} />
                      ))}
                  </Group>
                </Table.Th>
                <Table.Th
                  onClick={() => handleSort("isp")}
                  style={{ cursor: "pointer" }}
                >
                  <Group gap={4}>
                    ISP
                    {sortField === "isp" &&
                      (sortDirection === "asc" ? (
                        <IconSortAscending size={16} />
                      ) : (
                        <IconSortDescending size={16} />
                      ))}
                  </Group>
                </Table.Th>
                <Table.Th
                  onClick={() => handleSort("serverName")}
                  style={{ cursor: "pointer" }}
                >
                  <Group gap={4}>
                    Server
                    {sortField === "serverName" &&
                      (sortDirection === "asc" ? (
                        <IconSortAscending size={16} />
                      ) : (
                        <IconSortDescending size={16} />
                      ))}
                  </Group>
                </Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredTests.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={9} align="center">
                    <Text c="dimmed" py="md">
                      No data matching the filter
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredTests.map((test) => (
                  <Table.Tr key={test.id}>
                    <Table.Td>{formatDate(test.timestamp)}</Table.Td>
                    <Table.Td>
                      {test.user ? (
                        <Badge
                          leftSection={<IconUser size={14} />}
                          color="blue"
                        >
                          {test.user.name || test.user.email || "No name"}
                        </Badge>
                      ) : (
                        <Badge color="gray">Guest</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>{formatSpeed(test.downloadSpeed)}</Table.Td>
                    <Table.Td>{formatSpeed(test.uploadSpeed)}</Table.Td>
                    <Table.Td>{formatPing(test.ping)}</Table.Td>
                    <Table.Td>
                      {test.jitter ? formatPing(test.jitter) : "N/A"}
                    </Table.Td>
                    <Table.Td>{test.isp || "Unknown"}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {test.serverName || "Unknown"}
                        {test.testType && (
                          <Badge size="xs" variant="outline">
                            {test.testType}
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => handleDelete(test.id)}
                        aria-label="Delete"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Container>
  );
}
