import Button from "../../../components/ui/button/Button";
import { useEffect, useState } from "react";
import {
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaWhatsapp,
  FaYoutube,
} from "react-icons/fa";
import { FaSquareXTwitter } from "react-icons/fa6";
import { MdEmail, MdPhone, MdPlace } from "react-icons/md";
import { SiMessenger } from "react-icons/si";
import { Link, useParams } from "react-router";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { showApiError } from "../../../utils/apiError";

interface SiteInfo {
  _id: string;
  slug: string;
  storeName: string;
  propiterSlogan: string;
  adress: string;
  phone: string;
  email: string;
  businessHours: string;
  footer: string;
  facebookLink: string;
  youtubeLink: string;
  instagramLink: string;
  whatsappLink: string;
  twitterLink: string;
  messengerLink: string;
  linkedinLink: string;
  googleMapLink: string;
  qrCode: string;
  image?: { url?: string } | string;
  createdAt: string;
  updatedAt: string;
}

const SiteInfoView = () => {
  const { slug } = useParams<{ slug: string }>();
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axiosSecure.get(`/siteinformation/single-siteinformation/${slug}`);
        setSite(res.data?.data || null);
      } catch (error) {
        showApiError(error, "Failed to load site information.");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-gray-500 text-sm">Site information not found.</p>
        <Link to="/site-info-list" className="px-4 py-2 rounded bg-accent-500 hover:bg-accent-600 text-white text-sm">
          Back to List
        </Link>
      </div>
    );
  }

  const socialLinks = [
    { icon: <FaFacebook className="text-accent-600" />, label: "Facebook", url: site.facebookLink },
    { icon: <FaYoutube className="text-red-600" />, label: "YouTube", url: site.youtubeLink },
    { icon: <FaInstagram className="text-pink-500" />, label: "Instagram", url: site.instagramLink },
    { icon: <FaWhatsapp className="text-green-500" />, label: "WhatsApp", url: site.whatsappLink },
    { icon: <FaSquareXTwitter className="text-gray-800 dark:text-white" />, label: "Twitter / X", url: site.twitterLink },
    { icon: <SiMessenger className="text-accent-600" />, label: "Messenger", url: site.messengerLink },
    { icon: <FaLinkedin className="text-blue-700" />, label: "LinkedIn", url: site.linkedinLink },
  ].filter((s) => s.url);

  return (
    <>
      <PageMeta title={`${site.storeName} | Site Information`} description={`View details for ${site.storeName}`} />
      {/* Header row is just the trail and the record actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Site Details"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Link to={`/update-site-info/${site.slug}`}>
              <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                Edit
              </Button>
            </Link>
            <Link to="/site-info-list">
              <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                Site Info List
              </Button>
            </Link>
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex-shrink-0">
              {(typeof site.image === "string" ? site.image : site.image?.url) ? (
                <img
                  src={typeof site.image === "string" ? site.image : site.image?.url}
                  alt={site.storeName}
                  className="w-32 h-32 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2"
                />
              ) : (
                <div className="w-32 h-32 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-sm">
                  No Logo
                </div>
              )}
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{site.storeName}</h1>
              {site.propiterSlogan && (
                <p className="text-gray-500 dark:text-gray-400 mt-1 italic">"{site.propiterSlogan}"</p>
              )}
              <div className="mt-4 space-y-2">
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <MdPlace className="mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>{site.adress}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <MdPhone className="flex-shrink-0 text-gray-400" />
                  <span>{site.phone}</span>
                </div>
                {site.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <MdEmail className="flex-shrink-0 text-gray-400" />
                    <span>{site.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ComponentCard>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ComponentCard title="Additional Details">
            <dl className="space-y-3">
              {[
                ["Business Hours", site.businessHours],
                ["Footer Text", site.footer],
                ["QR Code", site.qrCode],
                ["Created At", new Date(site.createdAt).toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })],
                ["Updated At", new Date(site.updatedAt).toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label} className="flex flex-col sm:flex-row sm:gap-3">
                    <dt className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide sm:w-36 flex-shrink-0">{label}</dt>
                    <dd className="text-sm text-gray-700 dark:text-gray-200 break-all">{value}</dd>
                  </div>
                ))}
            </dl>
          </ComponentCard>

          {(socialLinks.length > 0 || site.googleMapLink) && (
            <ComponentCard title="Social & Contact Links">
              <div className="space-y-3">
                {socialLinks.map(({ icon, label, url }) => (
                  <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200 hover:text-accent-600 transition-colors group">
                    <span className="text-xl">{icon}</span>
                    <span className="font-medium">{label}</span>
                    <span className="text-xs text-gray-400 truncate group-hover:text-blue-400 max-w-xs">{url}</span>
                  </a>
                ))}
                {site.googleMapLink && (
                  <a href={site.googleMapLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200 hover:text-accent-600 transition-colors">
                    <MdPlace className="text-xl text-red-500" />
                    <span className="font-medium">Google Map</span>
                    <span className="text-xs text-gray-400 truncate max-w-xs">{site.googleMapLink}</span>
                  </a>
                )}
              </div>
            </ComponentCard>
          )}
        </div>
      </div>
    </>
  );
};

export default SiteInfoView;
