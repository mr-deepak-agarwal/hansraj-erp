"use client";

import { FormEvent, useState } from "react";

const API_URL = "http://localhost:8000/api/students/register";

const GENDERS = ["Male", "Female", "Other"] as const;

const CLASSES = [
  "Nursery",
  "LKG",
  "UKG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;

const DIVISIONS = ["A", "B", "C", "D"] as const;

type FormState = {
  name: string;
  gender: string;
  fathername: string;
  adhar: string;
  mobile: string;
  emailid: string;
  city: string;
  stdclass: string;
  stddiv: string;
  address: string;
};

const initialForm: FormState = {
  name: "",
  gender: "",
  fathername: "",
  adhar: "",
  mobile: "",
  emailid: "",
  city: "",
  stdclass: "",
  stddiv: "",
  address: "",
};

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15";

const labelClass = "text-sm font-medium text-slate-700";

export default function RegistrationPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    setSubmitting(true);

    const payload = {
      ...form,
      emailid: form.emailid.trim() || null,
      city: form.city.trim() || null,
      address: form.address.trim() || null,
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = data.detail;
        const message =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((item: { msg?: string }) => item.msg).join(" ")
              : "Registration failed. Please review the form and try again.";
        setAlert({ type: "error", message });
        return;
      }

      setAlert({
        type: "success",
        message: data.message ?? "Student registered successfully.",
      });
      setForm(initialForm);
    } catch {
      setAlert({
        type: "error",
        message: "Could not reach the registration service. Confirm the API is running on port 8000.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 [background-image:radial-gradient(ellipse_at_top,#eef2ff,transparent_55%)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            School ERP
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Student Registration
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Capture a new student record with the same fields used by the legacy system.
            All required details are validated before they are saved.
          </p>
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-8">
            <h2 className="text-base font-semibold text-slate-900">Admission details</h2>
            <p className="mt-1 text-sm text-slate-500">
              Fields marked with an asterisk are required.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
            {alert && (
              <div
                role="alert"
                className={`rounded-xl border px-4 py-3 text-sm ${
                  alert.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {alert.message}
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className={labelClass}>
                  Name *
                </label>
                <input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className={fieldClass}
                  placeholder="Student full name"
                />
              </div>

              <div>
                <label htmlFor="gender" className={labelClass}>
                  Gender *
                </label>
                <select
                  id="gender"
                  required
                  value={form.gender}
                  onChange={(e) => update("gender", e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select gender</option>
                  {GENDERS.map((gender) => (
                    <option key={gender} value={gender}>
                      {gender}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="fathername" className={labelClass}>
                  Father&apos;s Name *
                </label>
                <input
                  id="fathername"
                  required
                  value={form.fathername}
                  onChange={(e) => update("fathername", e.target.value)}
                  className={fieldClass}
                  placeholder="Father's full name"
                />
              </div>

              <div>
                <label htmlFor="adhar" className={labelClass}>
                  Aadhar Number *
                </label>
                <input
                  id="adhar"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{12}"
                  maxLength={12}
                  value={form.adhar}
                  onChange={(e) => update("adhar", e.target.value.replace(/\D/g, ""))}
                  className={fieldClass}
                  placeholder="12-digit Aadhaar"
                />
              </div>

              <div>
                <label htmlFor="mobile" className={labelClass}>
                  Mobile *
                </label>
                <input
                  id="mobile"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={form.mobile}
                  onChange={(e) => update("mobile", e.target.value.replace(/\D/g, ""))}
                  className={fieldClass}
                  placeholder="10-digit mobile"
                />
              </div>

              <div>
                <label htmlFor="emailid" className={labelClass}>
                  Email
                </label>
                <input
                  id="emailid"
                  type="email"
                  value={form.emailid}
                  onChange={(e) => update("emailid", e.target.value)}
                  className={fieldClass}
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label htmlFor="city" className={labelClass}>
                  City
                </label>
                <input
                  id="city"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  className={fieldClass}
                  placeholder="City"
                />
              </div>

              <div className="hidden sm:block" aria-hidden="true" />

              <div>
                <label htmlFor="stdclass" className={labelClass}>
                  Class *
                </label>
                <select
                  id="stdclass"
                  required
                  value={form.stdclass}
                  onChange={(e) => update("stdclass", e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select class</option>
                  {CLASSES.map((stdclass) => (
                    <option key={stdclass} value={stdclass}>
                      {stdclass}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="stddiv" className={labelClass}>
                  Division *
                </label>
                <select
                  id="stddiv"
                  required
                  value={form.stddiv}
                  onChange={(e) => update("stddiv", e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select division</option>
                  {DIVISIONS.map((stddiv) => (
                    <option key={stddiv} value={stddiv}>
                      {stddiv}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="address" className={labelClass}>
                  Address
                </label>
                <textarea
                  id="address"
                  rows={4}
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  className={`${fieldClass} resize-y`}
                  placeholder="Residential address"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setForm(initialForm);
                  setAlert(null);
                }}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Registering…" : "Register student"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
