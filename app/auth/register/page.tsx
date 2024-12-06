import {Center} from "@mantine/core";
import AuthenticationForm from "@/components/auth/login/page";
import RegisterPage from "@/components/auth/register/page";


const RegisterForm = () => {
    return (
        <Center style={{height: '100vh'}}>
            <RegisterPage/>
        </Center>
    );
};

export default RegisterForm;
