import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import ResetPasswordForm from "../../components/auth/ResetPasswordForm";

export default function ResetPassword() {
  return (
    <>
      <PageMeta title="Reset password" description="Reset your dashboard password" />
      <AuthLayout>
        <ResetPasswordForm />
      </AuthLayout>
    </>
  );
}
