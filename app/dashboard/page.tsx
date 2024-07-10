import DashboardLayout from "@/app/dashboard/DashboardLayout";
import {UserAccount} from "@/components/dashboard/User/UserAccount";


const UserPage = () => {
  return (
    <DashboardLayout>
      <UserAccount />
    </DashboardLayout>
  );
};

export default UserPage;
