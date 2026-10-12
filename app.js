const form = document.querySelector("#search-form");
const cityInput = document.querySelector("#city");
const geoBtn = document.querySelector("#geo-btn");
const statusEl = document.querySelector("#status");
const resultEl = document.querySelector("#result");

const placeEl = document.querySelector("#place");
const whenEl = document.querySelector("#when");
const tempEl = document.querySelector("#temp");
const conditionEl = document.querySelector("#condition");
const feelsEl = document.querySelector("#feels");
const humidityEl = document.querySelector("#humidity");
const windEl = document.querySelector("#wind");
const rangeEl = document.querySelector("#range");
const forecastEl = document.querySelector("#forecast");

const WMO = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

function setStatus(message, isError = false) {
  statusEl.hidden = !message;
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function formatTemp(value) {
  return `${Math.round(value)}°`;
}

function weekday(isoDate) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

async function geocodeCity(name) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not search that city.");
  const data = await res.json();
  const hit = data.results?.[0];
  if (!hit) throw new Error("No matching city found.");

  const parts = [hit.name, hit.admin1, hit.country].filter(Boolean);
  return {
    latitude: hit.latitude,
    longitude: hit.longitude,
    label: [...new Set(parts)].join(", "),
  };
}

async function reverseGeocode(latitude, longitude) {
  return { latitude, longitude, label: "Your location" };
}

async function fetchWeather(latitude, longitude) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude);
  url.searchParams.set("longitude", longitude);
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather service is unavailable.");
  return res.json();
}

function render(place, weather) {
  const { current, daily } = weather;
  placeEl.textContent = place;
  whenEl.textContent = new Date(current.time).toLocaleString(undefined, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
  tempEl.textContent = formatTemp(current.temperature_2m);
  conditionEl.textContent = WMO[current.weather_code] ?? "Conditions unavailable";
  feelsEl.textContent = formatTemp(current.apparent_temperature);
  humidityEl.textContent = `${current.relative_humidity_2m}%`;
  windEl.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  rangeEl.textContent = `${formatTemp(daily.temperature_2m_max[0])} / ${formatTemp(daily.temperature_2m_min[0])}`;

  forecastEl.replaceChildren(
    ...daily.time.map((date, i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="day">${i === 0 ? "Today" : weekday(date)}</span>
        <span class="hi">${formatTemp(daily.temperature_2m_max[i])}</span>
        <span class="lo">${formatTemp(daily.temperature_2m_min[i])}</span>
      `;
      return li;
    }),
  );

  resultEl.hidden = false;
}

async function loadWeather(placePromise) {
  form.querySelector("button[type=submit]").disabled = true;
  geoBtn.disabled = true;
  setStatus("Looking up weather…");
  resultEl.hidden = true;

  try {
    const place = await placePromise;
    const weather = await fetchWeather(place.latitude, place.longitude);
    render(place.label, weather);
    setStatus("");
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
  } finally {
    form.querySelector("button[type=submit]").disabled = false;
    geoBtn.disabled = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = cityInput.value.trim();
  if (!query) return;
  loadWeather(geocodeCity(query));
});

geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Geolocation is not supported in this browser.", true);
    return;
  }

  loadWeather(
    new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve(
            reverseGeocode(pos.coords.latitude, pos.coords.longitude),
          );
        },
        () => reject(new Error("Could not read your location.")),
        { timeout: 10000 },
      );
    }),
  );
});
