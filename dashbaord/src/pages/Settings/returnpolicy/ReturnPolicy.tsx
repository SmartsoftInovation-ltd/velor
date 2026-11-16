import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { usePermission } from "../../../hooks/usePermission";
import { showApiError } from "../../../utils/apiError";

// Only what the website keeps: the API drops any other formatting
const quillModules = {
  toolbar: [
    [{ header: [2, 3, 4, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "link", "clean"],
  ],
};

// The editor's empty document is "<p><br></p>", which is no policy at all
const isBlank = (html: string) => !html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

/** The return policy shown on the website's Return Policy page (footer link). One per store. */
const ReturnPolicy = () => {
  const navigate = useNavigate();
  const canEdit = usePermission("site-information", "edit");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    axiosSecure
      .get("/siteinformation/return-policy")
      .then((res) => {
        if (!active) return;
        const stored = res.data?.data?.content ?? "";
        setContent(stored);
        setSaved(stored);
      })
      .catch((error) => showApiError(error, "Failed to load the return policy"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await axiosSecure.put("/siteinformation/return-policy", { content: isBlank(content) ? "" : content });
      const stored = res.data?.data?.content ?? "";
      setContent(stored);
      setSaved(stored);
      toast.success(stored ? "Return policy saved" : "Return policy cleared");
    } catch (error) {
      showApiError(error, "Failed to save the return policy");
    } finally {
      setSaving(false);
    }
  };

  const changed = (isBlank(content) ? "" : content) !== saved;

  return (
    <>
      <PageMeta title="Return Policy" description="The return policy shown on the website" />
      <PageBreadcrumb
        pageTitle="Return Policy"
        className="mb-3"
        hideTitle
        actions={
          <Button
            onClick={() => navigate(-1)}
            size="sm"
            variant="outline"
            className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
            title="Go Back"
            aria-label="Go Back"
          >
            <FaArrowLeft className="size-3.5" />
          </Button>
        }
      />
      <ComponentCard
        title="Return Policy"
        desc="Shown on your website's Return Policy page, linked from the footer. Leave it empty to show the default policy."
      >
        {loading ? (
          <div className="h-72 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
        ) : (
          <div className="quill-container">
            <ReactQuill
              theme="snow"
              value={content}
              onChange={setContent}
              readOnly={!canEdit}
              modules={quillModules}
              placeholder="Write your return policy: how many days, which products, how refunds are paid…"
              className="return-policy-editor bg-white dark:bg-gray-900 rounded-xl overflow-hidden"
            />
            <style>{`.return-policy-editor .ql-editor { min-height: 360px; }`}</style>
          </div>
        )}
        {canEdit && (
          <div className="mt-4 flex items-center justify-end gap-3">
            {changed && <span className="text-xs text-gray-500 dark:text-gray-400">Unsaved changes</span>}
            <Button
              onClick={save}
              disabled={loading || saving || !changed}
              className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-5 py-2 rounded disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Return Policy"}
            </Button>
          </div>
        )}
      </ComponentCard>
    </>
  );
};

export default ReturnPolicy;
