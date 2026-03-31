import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { user } from "@/data/mockData";
import { ArrowLeft } from "lucide-react";

const PersonalInfo = () => {
  const navigate = useNavigate();
  const fields = [
    { label: "Legal First Name", value: user.firstName },
    { label: "Legal Last Name", value: user.lastName },
    { label: "Preferred Name", value: user.preferredName },
    { label: "Date of Birth", value: user.dob },
    { label: "Email", value: user.email },
    { label: "Phone", value: user.phone },
    { label: "SSN", value: user.ssn },
    { label: "Citizenship", value: user.citizenship },
    { label: "Occupation", value: user.occupation },
    { label: "Employer", value: user.employer },
    { label: "Annual Income", value: user.income },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <h1 className="text-lg font-display font-bold text-foreground">Personal Information</h1>
        </div>

        <GlassCard className="space-y-4">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground font-medium mb-0.5">{f.label}</p>
              <p className="text-sm font-medium text-foreground">{f.value}</p>
            </div>
          ))}
        </GlassCard>

        <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
          Request Information Update
        </button>
        <p className="text-xs text-muted-foreground text-center">
          For security, some changes require identity verification.
        </p>
      </div>
    </div>
  );
};

export default PersonalInfo;
