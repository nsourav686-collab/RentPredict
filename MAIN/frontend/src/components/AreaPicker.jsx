import { useEffect, useState } from "react";
import { apiGet } from "../services/api";

export default function AreaPicker({ city, value, onChange }) {
  const [areas, setAreas] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!city) {
      setAreas([]);
      setQuery("");
      onChange("");
    }
  }, [city]);

  useEffect(() => {
    if (!city) return;

    let active = true;
    setLoading(true);
    apiGet(`/api/areas?city=${encodeURIComponent(city)}&q=${encodeURIComponent(query)}`)
      .then((data) => {
        if (!active) return;

        const nextAreas = data.areas || [];
        setAreas(nextAreas);

        if (nextAreas.length === 0) {
          onChange("");
          return;
        }

        if (!nextAreas.includes(value)) {
          onChange(nextAreas[0]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [city, query, value]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Type area name"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={!city}
      />
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setQuery(event.target.value);
        }}
        required
        disabled={!city || loading}
      >
        {!city && <option value="">Select city first</option>}
        {loading && <option value="">Loading areas...</option>}
        {!loading && areas.length === 0 && city && <option value="">No areas found</option>}
        {!loading &&
          areas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
      </select>
    </div>
  );
}
