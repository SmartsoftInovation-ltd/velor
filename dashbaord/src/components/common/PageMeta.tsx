import { HelmetProvider, Helmet } from "react-helmet-async";

// Every page's browser tab reads the same; `title` is no longer shown
const APP_TITLE = "ECOMPOS MASTER | Smartsoft Innovation";

const PageMeta = ({
  description,
}: {
  title?: string;
  description: string;
}) => (
  <Helmet>
    <title>{APP_TITLE}</title>
    <meta name="description" content={description} />
  </Helmet>
);

export const AppWrapper = ({ children }: { children: React.ReactNode }) => (
  <HelmetProvider>{children}</HelmetProvider>
);

export default PageMeta;
