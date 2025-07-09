import { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

export default function App() {
  const [outlets, setOutlets] = useState([]);
  const [position] = useState([3.139, 101.6869]); // KL center

  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [catchments, setCatchments] = useState([]);

  function getServiceIcon(service) {
    const icons = {
      "24 Hours": "🕐",
      "Birthday Party": "🎉",
      "Breakfast": "🍳",
      "Cashless Facility": "💳",
      "Dessert Center": "🍦",
      "Drive-Thru": "🚗",
      "McCafe": "☕",
      "McDelivery": "📦",
      "Surau": "🕌",
      "WiFi": "📶",
      "Digital Order Kiosk": "📱",
      "Electric Vehicle": "🔌",
    };

    return icons[service];
  }

  const fetchCatchments = async (outletId) => {
    const res = await fetch(
      `https://sound-inez-syahrilshahiran-98f14f14.koyeb.app/outlet/${outletId}/catchment`
    );
    const data = await res.json();
    setCatchments(data);
  };

  useEffect(() => {
    fetch("https://sound-inez-syahrilshahiran-98f14f14.koyeb.app/outlets")
      .then((res) => res.json())
      .then((data) => setOutlets(data))
      .catch((err) => console.error("Failed to fetch outlets:", err));
  }, []);

  // Memoized markers to prevent unnecessary re-renders
  const markers = outlets.map((o, idx) =>
    o.latitude && o.longitude ? (
      <Marker
        key={`${o.id}-${idx}`} // Use stable key
        position={[o.latitude, o.longitude]}
        eventHandlers={{
          click: () => {
            setSelectedOutlet(o);
            fetchCatchments(o.id);
          },
        }}
        icon={L.icon({
          iconUrl:
            "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        })}
      >
        <Popup>
          <strong>{o.name}</strong>
          <br />
          {o.address}
          <br />
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${o.latitude},${o.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            🗺️ View on Google Maps
          </a>
          <br />
          {o.services.map((s, idx) => (
            <div key={`service-${idx}`}>
              {getServiceIcon(s)} {s}
            </div>
          ))}
        </Popup>
      </Marker>
    ) : null
  );

  function ChatControl() {
    const map = useMap();
    const controlRef = useRef(null);
    const isInitialized = useRef(false);

    useEffect(() => {
      // Check if already initialized or if control already exists
      if (isInitialized.current || controlRef.current) return;

      // Also check if there's already a chat control in the DOM
      if (document.getElementById("chat-control")) return;

      isInitialized.current = true;

      const chatDiv = L.DomUtil.create("div", "leaflet-chat-box");
      chatDiv.id = "chat-control";

      chatDiv.innerHTML = `
      <div style="padding:10px; background:white; width:320px; height:auto; box-shadow: 0 0 10px rgba(0,0,0,0.2); border-radius: 10px; color:black;">
        <h4>🤖 Ask McD AI</h4>
        <input id="chat-input" style="width:100%;margin-bottom:5px; padding:5px; border:1px solid #ccc; border-radius:4px;" placeholder="Ask something..." />
        <button id="chat-send" style="width:100%; margin-bottom:5px; padding:8px; background:#007bff; color:white; border:none; border-radius:4px; cursor:pointer;">Ask</button>
        <div id="chat-loading" style="display:none; margin-bottom:5px; color:#666;">⏳ Thinking...</div>
        <div id="chat-answer" style="margin-top:10px; font-size:14px; max-height:300px; overflow:auto; line-height:1.4;"></div>
      </div>
    `;

      const chatControl = L.control({ position: "topright" });
      chatControl.onAdd = () => chatDiv;
      chatControl.addTo(map);

      controlRef.current = chatControl;

      const input = chatDiv.querySelector("#chat-input");
      const button = chatDiv.querySelector("#chat-send");
      const loading = chatDiv.querySelector("#chat-loading");
      const output = chatDiv.querySelector("#chat-answer");

      // Format text to handle lists and better formatting
      const formatResponse = (text) => {
        // Convert numbered lists
        text = text.replace(
          /(\d+\.\s+)([^\n]+)/g,
          '<div style="margin:5px 0;"><strong>$1</strong>$2</div>'
        );

        // Convert bullet points
        text = text.replace(
          /(\*\s+|•\s+|−\s+)([^\n]+)/g,
          '<div style="margin:5px 0; padding-left:15px;">• $2</div>'
        );

        // Convert headers (lines that end with :)
        text = text.replace(
          /^([^:\n]+):$/gm,
          '<div style="font-weight:bold; margin:10px 0 5px 0; color:#333;">$1:</div>'
        );

        // Convert line breaks to proper spacing
        text = text.replace(/\n\n/g, "<br><br>");
        text = text.replace(/\n/g, "<br>");

        return text;
      };

      const askAI = async (question) => {
        output.innerHTML = "";
        loading.style.display = "block";

        try {
          const res = await fetch("https://sound-inez-syahrilshahiran-98f14f14.koyeb.app/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: question }),
          });

          if (!res.ok || !res.body) {
            output.innerHTML = "⚠️ Failed to get response from AI.";
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder("utf-8");

          let done = false;
          let fullText = "";

          while (!done) {
            const { value, done: doneReading } = await reader.read();
            if (value) {
              const chunk = decoder.decode(value);
              fullText += chunk;
              // Format and display the accumulated text
              output.innerHTML = formatResponse(fullText);
              // Auto-scroll to bottom
              output.scrollTop = output.scrollHeight;
            }
            done = doneReading;
          }
        } catch (err) {
          output.innerHTML = "❌ Error occurred while fetching response.";
          console.error(err);
        } finally {
          loading.style.display = "none";
        }
      };

      const handleSubmit = () => {
        const userInput = input.value.trim();
        if (userInput) {
          askAI(userInput);
          input.value = ""; // Clear input after sending
        }
      };

      button.addEventListener("click", handleSubmit);

      // Add Enter key support
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          handleSubmit();
        }
      });

      // Prevent map interactions when interacting with chat
      L.DomEvent.disableClickPropagation(chatDiv);
      L.DomEvent.disableScrollPropagation(chatDiv);

      // Cleanup function to remove control on unmount
      return () => {
        if (
          controlRef.current &&
          map.hasLayer &&
          map.hasLayer(controlRef.current)
        ) {
          map.removeControl(controlRef.current);
          controlRef.current = null;
        }
        isInitialized.current = false;
      };
    }, [map]);

    return null;
  }

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial",
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h2>🗺️ McDonald's Map & 🤖 AI Chat</h2>

      <MapContainer
        center={position}
        zoom={12}
        style={{ height: "80vh", width: "90vw", borderRadius: "10px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {markers}

        {catchments.map((c, idx) => (
          <Circle
            key={`catchment-${idx}`}
            center={[c.latitude, c.longitude]}
            radius={500}
            pathOptions={{ color: "green", fillOpacity: 0.2 }}
          />
        ))}

        {selectedOutlet &&
          catchments.map((c, idx) => (
            <Polyline
              key={`line-${idx}`}
              positions={[
                [selectedOutlet.latitude, selectedOutlet.longitude],
                [c.latitude, c.longitude],
              ]}
              pathOptions={{ color: "red" }}
            />
          ))}

        <ChatControl />
      </MapContainer>
    </div>
  );
}
