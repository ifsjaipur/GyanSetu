import dynamic from "next/dynamic";

const DynamicLoginGlobe = dynamic(() => import("./LoginGlobe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#64ffda] border-t-transparent" />
    </div>
  ),
});

export default DynamicLoginGlobe;
