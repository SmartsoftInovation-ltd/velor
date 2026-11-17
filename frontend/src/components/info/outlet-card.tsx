import type { ComponentType, ReactNode } from "react";
import { AppImage } from "@/components/ui/app-image";
import { CalendarIcon, ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "@/components/ui/icons-footer";
import { UserIcon } from "@/components/ui/icons-nav";
import type { Outlet } from "@/lib/outlets";

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

function Row({ Icon, children }: { Icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <li className="flex gap-2.5 text-small text-text-secondary">
      <Icon className="mt-0.5 size-4 shrink-0 text-brand-500" />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

/** One branch: photo on top, then where it is, who runs it and when it opens */
export function OutletCard({ outlet }: { outlet: Outlet }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="relative aspect-video bg-bg-sunken">
        <AppImage
          src={outlet.image || "/image-fallback.svg"}
          alt={`${outlet.name} outlet`}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      <div className="flex-1 space-y-3 p-5">
        <h2 className="text-h3 font-semibold text-text-primary">{outlet.name}</h2>
        <ul className="space-y-2">
          {outlet.address ? <Row Icon={MapPinIcon}>{outlet.address}</Row> : null}
          {outlet.managerName ? (
            <Row Icon={UserIcon}>
              Manager: <span className="font-semibold text-text-primary">{outlet.managerName}</span>
            </Row>
          ) : null}
          {outlet.managerMobile ? (
            <Row Icon={PhoneIcon}>
              <a href={telHref(outlet.managerMobile)} className="transition-colors hover:text-brand-500">
                {outlet.managerMobile}
              </a>
            </Row>
          ) : null}
          {outlet.email ? (
            <Row Icon={MailIcon}>
              <a href={`mailto:${outlet.email}`} className="text-brand-500 underline-offset-2 hover:underline">
                {outlet.email}
              </a>
            </Row>
          ) : null}
          {outlet.businessHour ? <Row Icon={ClockIcon}>{outlet.businessHour}</Row> : null}
          {outlet.offDay ? (
            <Row Icon={CalendarIcon}>
              Off Day: <span className="font-semibold text-text-primary">{outlet.offDay}</span>
            </Row>
          ) : null}
        </ul>
      </div>
    </article>
  );
}
