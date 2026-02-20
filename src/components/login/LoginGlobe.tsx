"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import GlobeGL, { type GlobeMethods } from "react-globe.gl";
import { APP_NAME } from "@/lib/utils/constants";

interface GeoFeature {
  type: string;
  properties: { ISO_A2: string; NAME: string };
  geometry: object;
}

interface GeoJson {
  type: string;
  features: GeoFeature[];
}

export default function LoginGlobe() {
  const globeRef = useRef<GlobeMethods>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<GeoFeature[]>([]);
  const [userCountry, setUserCountry] = useState("");
  const [locationName, setLocationName] = useState("Detecting Global Campus...");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Resize observer for responsive globe sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Load GeoJSON countries + user geolocation
  useEffect(() => {
    // Load country polygons
    fetch(
      "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson"
    )
      .then((res) => res.json())
      .then((data: GeoJson) => setCountries(data.features))
      .catch(() => {});

    // Detect user location
    fetch("https://ipapi.co/json/")
      .then((res) => res.json())
      .then((data) => {
        setUserCountry(data.country_code || "");
        setLocationName(data.country_name || "Global Access Mode");

        // Fly to user's location after a short delay
        setTimeout(() => {
          globeRef.current?.pointOfView(
            { lat: data.latitude, lng: data.longitude, altitude: 1.5 },
            4000
          );
        }, 1000);
      })
      .catch(() => {
        setLocationName("Global Access Mode");
        // Default fly to India
        setTimeout(() => {
          globeRef.current?.pointOfView(
            { lat: 20, lng: 77, altitude: 2.0 },
            2000
          );
        }, 1000);
      });
  }, []);

  // Setup auto-rotate + disable zoom once globe is ready
  const handleGlobeReady = useCallback(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.enableZoom = false;
  }, []);

  // Polygon color: highlight user's country
  const getPolygonCapColor = useCallback(
    (feat: object) => {
      const f = feat as GeoFeature;
      return f.properties.ISO_A2 === userCountry
        ? "rgba(100, 255, 218, 0.6)"
        : "rgba(255, 255, 255, 0.03)";
    },
    [userCountry]
  );

  const getPolygonAltitude = useCallback(
    (feat: object) => {
      const f = feat as GeoFeature;
      return f.properties.ISO_A2 === userCountry ? 0.04 : 0.006;
    },
    [userCountry]
  );

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {/* Overlay text */}
      <div className="pointer-events-none absolute left-10 top-10 z-10">
        <h1 className="text-2xl font-extrabold uppercase tracking-wide text-[#64ffda]">
          {APP_NAME}
        </h1>
        <p className="mt-1 text-sm text-[#8892b0]">
          Connecting from:{" "}
          <span className="text-white">{locationName}</span>
        </p>
      </div>

      {dimensions.width > 0 && (
        <GlobeGL
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-dark.jpg"
          bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
          backgroundColor="rgba(0,0,0,0)"
          showAtmosphere={true}
          atmosphereColor="#4fc3f7"
          atmosphereAltitude={0.25}
          polygonsData={countries}
          polygonCapColor={getPolygonCapColor}
          polygonSideColor={() => "rgba(30, 41, 59, 0.15)"}
          polygonStrokeColor={() => "rgba(255, 255, 255, 0.08)"}
          polygonAltitude={getPolygonAltitude}
          polygonsTransitionDuration={300}
          onGlobeReady={handleGlobeReady}
        />
      )}
    </div>
  );
}
