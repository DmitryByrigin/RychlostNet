'use client';

import { useCurrentUser } from '@/hooks/use-current-user';

const ClientPage = () => {
  const user = useCurrentUser();
  // UserInfo label="📱 Client component" user={user}
  return < div/>;
};

export default ClientPage;
