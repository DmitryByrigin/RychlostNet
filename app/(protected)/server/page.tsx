import { currentUser } from '@/lib/auth';
// import { UserInfo } from '@/components/user-info';

const ServerPage = async () => {
  const user = await currentUser();
  // UserInfo label="💻 Server component" user={user}
  return < div/>;
};

export default ServerPage;
