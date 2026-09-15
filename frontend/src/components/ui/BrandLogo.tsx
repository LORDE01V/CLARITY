import { BRAND_NAME, LOGO_URL } from "@/lib/brand";

export function BrandLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const boxSize = size === "sm" ? "size-7" : "size-8";
  const textSize = size === "sm" ? "text-[15px]" : "text-[17px]";

  return (
    <div className="flex items-center gap-2.5">
      <div className={`${boxSize} overflow-hidden rounded-lg bg-white`}>
        <img
          src={LOGO_URL}
          alt=""
          aria-hidden
          className="h-full w-full object-contain object-center p-0.5"
        />
      </div>
      <span className={`${textSize} font-semibold tracking-[-0.03em] text-text-body`}>
        {BRAND_NAME}
      </span>
    </div>
  );
}
