import {Center} from "@mantine/core";
import AuthenticationForm from "@/components/auth/login/page";


const LoginPage = () => {
    return (
        <Center style={{height: '100vh'}}>
            <AuthenticationForm/>
        </Center>
    );
};

export default LoginPage;
