import { useState } from "react";
import { FaArrowLeft, FaSync } from "react-icons/fa";
import { useNavigate } from "react-router";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import ContactMessageTable from "../../../components/tables/ContactMessageTable/ContactMessageTable";
import Button from "../../../components/ui/button/Button";

const ICON_BTN =
  "size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90";

/** Messages from the website's Contact page */
const ContactMessageList = () => {
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <>
      <PageMeta title="Baig Ecommerce Admin Dashboard" description="Messages sent from the website's Contact page" />
      <PageBreadcrumb
        pageTitle="Contact Messages"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate(-1)} size="sm" variant="outline" className={ICON_BTN} title="Go Back" aria-label="Go Back">
              <FaArrowLeft className="size-3.5" />
            </Button>
            <Button onClick={() => setReloadKey((k) => k + 1)} size="sm" variant="outline" className={ICON_BTN} title="Refresh" aria-label="Refresh">
              <FaSync className="size-3.5" />
            </Button>
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <ContactMessageTable key={reloadKey} />
        </ComponentCard>
      </div>
    </>
  );
};

export default ContactMessageList;
