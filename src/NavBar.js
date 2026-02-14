import React, { useState, useEffect, useContext } from "react";
import { useNavigate, NavLink, useParams } from "react-router-dom";
import { backendURL } from "./config";
import { AuthContext } from "./AuthContext";

export default function Navbar() {
  const { user } = useContext(AuthContext); // ✅ Use auth context
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const { category } = useParams();
  const navigate = useNavigate();

  // Fetch categories immediately if user is logged in
  useEffect(() => {
    if (!user || loading) return;

    const fetchCategories = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${backendURL}/categories`);
        const data = await res.json();
        setCategories(data);
      } catch (err) {
        console.error("Error loading categories:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [user]);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        !e.target.closest(".dropdown") &&
        !e.target.closest(".dropdown-toggle")
      ) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinkStyle = ({ isActive }) => ({
    padding: "12px 16px",
    borderRadius: "10px",
    background: isActive
      ? "linear-gradient(135deg, rgba(132, 10, 22, 0.1), rgba(132, 10, 22, 0.05))"
      : "transparent",
    color: isActive ? "#840A16" : "#374151",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: isActive ? "600" : "500",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    border: isActive
      ? "1px solid rgba(132, 10, 22, 0.2)"
      : "1px solid transparent",
  });

  if (!user) return null; // don't render navbar if not logged in

  return (
    <div
      style={{ position: "relative", display: "inline-block", width: "100%" }}
    >
      {/* Tools Button */}
      <button
        className="dropdown-toggle"
        onClick={() => setCategoryDropdownOpen((prev) => !prev)}
        style={{
          background: "linear-gradient(135deg, #840A16, #A91827)",
          color: "#fff",
          border: "none",
          borderRadius: "12px",
          padding: "14px 18px",
          cursor: "pointer",
          fontSize: "15px",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          boxShadow:
            "0 4px 12px rgba(132, 10, 22, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 8px rgba(34, 197, 94, 0.6)",
            }}
          />
          <span>Tools</span>
        </div>
        <span
          style={{
            opacity: 0.9,
            transition: "transform 0.2s ease",
            transform: categoryDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>

      {/* Dropdown */}
      {categoryDropdownOpen && (
        <div
          className="dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            boxShadow:
              "0 10px 25px rgba(0, 0, 0, 0.15), 0 5px 10px rgba(0, 0, 0, 0.05)",
            padding: "8px",
            zIndex: 1000,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            animation: "dropdownSlide 0.2s ease-out",
          }}
        >
          <NavLink
            to="/"
            style={navLinkStyle}
            onClick={() => setCategoryDropdownOpen(false)}
          >
            <span style={{ fontSize: "16px" }}>🎤</span>
            Basic Transcriber
          </NavLink>

          {loading && (
            <div
              style={{
                padding: "12px 16px",
                fontStyle: "italic",
                color: "#9ca3af",
              }}
            >
              Loading categories...
            </div>
          )}

          {!loading &&
            categories.map((cat) => {
              const isActive = cat.key === category;
              return (
                <div
                  key={cat.key}
                  onClick={() => {
                    navigate(`/lekhani/${cat.key}`);
                    setCategoryDropdownOpen(false);
                  }}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    background: isActive
                      ? "linear-gradient(135deg, rgba(132, 10, 22, 0.1), rgba(132, 10, 22, 0.05))"
                      : "transparent",
                    color: isActive ? "#840A16" : "#374151",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: isActive ? "600" : "500",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <span style={{ fontSize: "16px" }}>📝</span>
                  {cat.label}
                </div>
              );
            })}
        </div>
      )}

      <style jsx>{`
        @keyframes dropdownSlide {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
