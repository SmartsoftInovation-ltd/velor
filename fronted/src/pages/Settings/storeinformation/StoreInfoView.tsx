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
import Button from "../../../components/ui/button/Button";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { showApiError } from "../../../utils/apiError";

interface StoreInfo {
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
  isActive: boolean;
  image: { url: string; status: string };
  createdAt: string;
  updatedAt: string;
}

const StoreInfoView = () => {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const res = await axiosSecure.get(
          `/storeinformation/store-information/${slug}`,
        );
        setStore(res.data?.data?.store || null);
      } catch (error) {
        showApiError(error, "Failed to load store information.");
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-gray-500 text-sm">Store information not found.</p>
        <Link to="/store-info-list">
          <Button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
            Back to List
          </Button>
        </Link>
      </div>
    );
  }

  const socialLinks = [
    {
      icon: <FaFacebook className="text-blue-600" />,
      label: "Facebook",
      url: store.facebookLink,
    },
    {
      icon: <FaYoutube className="text-red-600" />,
      label: "YouTube",
      url: store.youtubeLink,
    },
    {
      icon: <FaInstagram className="text-pink-500" />,
      label: "Instagram",
      url: store.instagramLink,
    },
    {
      icon: <FaWhatsapp className="text-green-500" />,
      label: "WhatsApp",
      url: store.whatsappLink,
    },
    {
      icon: <FaSquareXTwitter className="text-gray-800 dark:text-white" />,
      label: "Twitter / X",
      url: store.twitterLink,
    },
    {
      icon: <SiMessenger className="text-blue-500" />,
      label: "Messenger",
      url: store.messengerLink,
    },
    {
      icon: <FaLinkedin className="text-blue-700" />,
      label: "LinkedIn",
      url: store.linkedinLink,
    },
  ].filter((s) => s.url);

  return (
    <>
      <PageMeta
        title={`${store.storeName} | Store Information`}
        description={`View details for ${store.storeName}`}
      />
      {/* Header row is just the trail and the record actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Store Details"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/store-info-list">
            <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
              Store Info List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        {/* Header card */}
        <ComponentCard>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Logo */}
            <div className="flex-shrink-0">
              {store.image?.url ? (
                <img
                  src={store.image.url}
                  alt={store.storeName}
                  className="w-32 h-32 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2"
                />
              ) : (
                <div className="w-32 h-32 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-sm">
                  No Logo
                </div>
              )}
              <span
                className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  store.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {store.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            {/* Name & slogan */}
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                {store.storeName}
              </h1>
              {store.propiterSlogan && (
                <p className="text-gray-500 dark:text-gray-400 mt-1 italic">
                  "{store.propiterSlogan}"
                </p>
              )}

              <div className="mt-4 space-y-2">
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <MdPlace className="mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>{store.adress}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <MdPhone className="flex-shrink-0 text-gray-400" />
                  <span>{store.phone}</span>
                </div>
                {store.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <MdEmail className="flex-shrink-0 text-gray-400" />
                    <span>{store.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ComponentCard>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Details card */}
          <ComponentCard title="Additional Details">
            <dl className="space-y-3">
              {[
                ["Business Hours", store.businessHours],
                ["Footer Text", store.footer],
                ["QR Code", store.qrCode],
                [
                  "Created At",
                  new Date(store.createdAt).toLocaleDateString("en-BD", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }),
                ],
                [
                  "Updated At",
                  new Date(store.updatedAt).toLocaleDateString("en-BD", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }),
                ],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-col sm:flex-row sm:gap-3"
                  >
                    <dt className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide sm:w-36 flex-shrink-0">
                      {label}
                    </dt>
                    <dd className="text-sm text-gray-700 dark:text-gray-200 break-all">
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
          </ComponentCard>

          {/* Social links card */}
          {socialLinks.length > 0 && (
            <ComponentCard title="Social & Contact Links">
              <div className="space-y-3">
                {socialLinks.map(({ icon, label, url }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-blue-400 transition-colors group"
                  >
                    <span className="text-xl">{icon}</span>
                    <span className="font-medium">{label}</span>
                    <span className="text-xs text-gray-400 truncate group-hover:text-blue-400 max-w-xs">
                      {url}
                    </span>
                  </a>
                ))}

                {store.googleMapLink && (
                  <a
                    href={store.googleMapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                  >
                    <MdPlace className="text-xl text-red-500" />
                    <span className="font-medium">Google Map</span>
                    <span className="text-xs text-gray-400 truncate max-w-xs">
                      {store.googleMapLink}
                    </span>
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

export default StoreInfoView;
