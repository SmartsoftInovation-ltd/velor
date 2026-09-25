import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import toast from "react-hot-toast";
import { MdDelete } from "react-icons/md";
import { FaPlus, FaUser, FaBriefcase, FaAddressBook, FaMoneyBillWave, FaUserFriends, FaCertificate, FaCamera } from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import SearchableSelect from "../form/SearchableSelect";
import DatePicker from "../form/date-picker";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import SectionCard from "../common/SectionCard";
import MobileActionBar from "../common/MobileActionBar";
import { Link } from "react-router";
import QuickCreateModal from "./QuickCreateModal";
import { showApiError } from "../../utils/apiError";
import { scopedStorageKey } from "../../lib/session";

// ---------- Types ----------
interface Certification {
  title: string;
  institute: string;
  year: string;
  details: string;
  imageFile: File | null;
  imagePreview: string | null;
}

interface SalaryForm {
  basicSalary: string;
  houseRent: string;
  medicalAllowance: string;
  othersAllowance: string;
  specialAllowance: string;
  providentFund: string;
}

interface EmployeeForm {
  fullName: string;
  nidNumber: string;
  designation: string;
  department: string;
  section: string;
  educationalQualification: string;
  dateOfBirth: string;
  gender: string;
  religion: string;
  bloodGroup: string;
  nationality: string;
  fathersName: string;
  mothersName: string;
  mobile: string;
  secondaryMobile: string;
  email: string;
  presentAddress: string;
  permanentAddress: string;
  joiningDate: string;
  referencePersonName: string;
  referencePersonDetails: string;
  referenceMobile: string;
  comments: string;
  salary: SalaryForm;
}

interface Tab1Errors {
  fullName?: string;
  designation?: string;
  department?: string;
  gender?: string;
}

interface Tab2Errors {
  joiningDate?: string;
  basicSalary?: string;
}

const GENDERS = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
];

const EMPTY_CERT: Certification = {
  title: "",
  institute: "",
  year: "",
  details: "",
  imageFile: null,
  imagePreview: null,
};

// ---------- Cert image dropzone ----------
const CertImageDropzone = ({
  index,
  preview,
  onDrop,
  onRemove,
}: {
  index: number;
  preview: string | null;
  onDrop: (index: number, file: File) => void;
  onRemove: (index: number) => void;
}) => {
  const handleDrop = useCallback(
    (accepted: File[], rejected: any[]) => {
      if (rejected.length > 0) { toast.error("Invalid file or too large (max 2MB)."); return; }
      if (accepted.length > 0) onDrop(index, accepted[0]);
    },
    [index, onDrop],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: { "image/png": [], "image/jpeg": [], "image/jpg": [], "image/gif": [] },
    maxSize: 2 * 1024 * 1024,
    multiple: false,
  });

  if (preview) {
    return (
      <div className="flex items-center gap-3">
        <img src={preview} alt="Certificate" className="size-16 rounded-xl object-cover border border-gray-200 dark:border-gray-700" />
        <button type="button" onClick={() => onRemove(index)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors">
          <MdDelete className="size-3.5" /> Remove
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors duration-150 ${
        isDragActive ? "border-accent-500 bg-accent-50 dark:bg-accent-500/10" : "border-gray-300 dark:border-gray-600 hover:border-accent-400 bg-gray-50 dark:bg-gray-800/50"
      }`}
    >
      <input {...getInputProps()} />
      <p className="text-xs text-gray-500 dark:text-gray-400">{isDragActive ? "Drop here..." : "Click or drag certificate image"}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">PNG, JPG, GIF — max 2MB</p>
    </div>
  );
};

// ---------- Main component ----------
const EmployeeEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [designationList, setDesignationList] = useState<{ label: string; value: string }[]>([]);
  const [departmentList, setDepartmentList] = useState<{ label: string; value: string }[]>([]);
  const [sectionList, setSectionList] = useState<{ label: string; value: string }[]>([]);
  const [quickCreate, setQuickCreate] = useState<"designation" | "department" | "section" | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tab1Errors, setTab1Errors] = useState<Tab1Errors>({});
  const [tab2Errors, setTab2Errors] = useState<Tab2Errors>({});
  const [employeeIdCode, setEmployeeIdCode] = useState<string>("");

  const [form, setForm] = useState<EmployeeForm>({
    fullName: "", nidNumber: "", designation: "", department: "", section: "",
    educationalQualification: "", dateOfBirth: "", gender: "",
    religion: "", bloodGroup: "", nationality: "", fathersName: "",
    mothersName: "", mobile: "", secondaryMobile: "", email: "",
    presentAddress: "", permanentAddress: "",
    joiningDate: new Date().toISOString().split("T")[0],
    referencePersonName: "", referencePersonDetails: "", referenceMobile: "",
    comments: "",
    salary: { basicSalary: "", houseRent: "", medicalAllowance: "", othersAllowance: "", specialAllowance: "", providentFund: "" },
  });

  // Fetch designation + section lists
  useEffect(() => {
    axiosSecure.get("/employee/get-employee-designation")
      .then((res) => {
        const list = res?.data?.data?.designations || [];
        setDesignationList(list.map((d: any) => ({ label: d.name || d, value: d._id })));
      })
      .catch((error) => showApiError(error, "Failed to load designations."));

    axiosSecure.get("/employee/get-employee-department")
      .then((res) => {
        const list = res?.data?.data?.departments || [];
        setDepartmentList(list.map((d: any) => ({ label: d.name || d, value: d._id })));
      })
      .catch((error) => showApiError(error, "Failed to load departments."));

    axiosSecure.get("/employee/get-employee-section")
      .then((res) => {
        const list = res?.data?.data?.sections || [];
        setSectionList(list.map((s: any) => ({ label: s.name || s, value: s._id })));
      })
      .catch((error) => showApiError(error, "Failed to load sections."));
  }, []);

  // Fetch existing employee data — always fresh so form reflects latest DB state
  const { data: employee, isLoading: isFetching, isError } = useQuery({
    queryKey: ["employee-edit", id],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/employee/get-employee");
      const list = data.data.employees || [];
      const found = list.find((e: any) => e._id === id);
      if (!found) throw new Error("Not found");
      return found;
    },
    enabled: !!id,
    staleTime: 0,
  });

  // Populate form when data arrives
  useEffect(() => {
    if (!employee) return;

    setEmployeeIdCode(employee.employeeId || "");
    setPreview(
      typeof employee.image === "string"
        ? employee.image
        : employee.image?.url || null
    );

    setForm({
      fullName: employee.fullName || "",
      nidNumber: employee.nidNumber || "",
      designation: employee.designation?._id || employee.designation || "",
      department: employee.deapartment?._id || employee.deapartment || employee.department?._id || employee.department || "",
      section: employee.section?._id || employee.section || "",
      educationalQualification: employee.educationalQualification || "",
      dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split("T")[0] : "",
      gender: employee.gender || "",
      religion: employee.religion || "",
      bloodGroup: employee.bloodGroup || "",
      nationality: employee.nationality || "",
      fathersName: employee.fathersName || "",
      mothersName: employee.mothersName || "",
      mobile: employee.mobile || "",
      secondaryMobile: employee.secondaryMobile || "",
      email: employee.email || "",
      presentAddress: employee.presentAddress || "",
      permanentAddress: employee.permanentAddress || "",
      joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString().split("T")[0] : "",
      referencePersonName: employee.referencePersonName || "",
      referencePersonDetails: employee.referencePersonDetails || "",
      referenceMobile: employee.referenceMobile || "",
      comments: employee.comments || "",
      salary: {
        basicSalary: String(employee.salary?.basicSalary || ""),
        houseRent: String(employee.salary?.houseRent || ""),
        medicalAllowance: String(employee.salary?.medicalAllowance || ""),
        othersAllowance: String(employee.salary?.othersAllowance || ""),
        specialAllowance: String(employee.salary?.specialAllowance || ""),
        providentFund: String(employee.salary?.providentFund || ""),
      },
    });

    // Always reset certifications from fetched data (even if empty array)
    setCertifications(
      (employee.certifications || []).map((c: any) => {
        const imgUrl =
          c.image && typeof c.image === "object" && c.image.status === "uploaded"
            ? c.image.url || null
            : typeof c.image === "string" && c.image
              ? c.image
              : null;
        return {
          title: c.title || "",
          institute: c.institute || "",
          year: c.year || "",
          details: c.details || "",
          imageFile: null,
          imagePreview: imgUrl,
        };
      })
    );
  }, [employee]);

  // One page of sections now (was a 3-step wizard): a failed validation
  // scrolls to the section holding the error.
  const goToTab = (tab: 1 | 2 | 3) =>
    document
      .getElementById(tab === 1 ? "sec-personal" : tab === 2 ? "sec-salary" : "sec-certs")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleChange = (name: keyof EmployeeForm, value: string) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  const handleSalaryChange = (name: keyof SalaryForm, value: string) =>
    setForm((prev) => ({ ...prev, salary: { ...prev.salary, [name]: value } }));

  const handleCertChange = (index: number, field: keyof Omit<Certification, "imageFile" | "imagePreview">, value: string) => {
    setCertifications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleCertImageDrop = useCallback((index: number, file: File) => {
    setCertifications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], imageFile: file, imagePreview: URL.createObjectURL(file) };
      return next;
    });
  }, []);

  const handleCertImageRemove = useCallback((index: number) => {
    setCertifications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], imageFile: null, imagePreview: null };
      return next;
    });
  }, []);

  const addCertification = () => setCertifications((prev) => [...prev, { ...EMPTY_CERT }]);
  const removeCertification = (index: number) => setCertifications((prev) => prev.filter((_, i) => i !== index));

  // Profile photo dropzone
  const onProfileDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) { toast.error("Invalid file or too large (max 1MB)."); return; }
    if (acceptedFiles.length > 0) {
      setImage(acceptedFiles[0]);
      setPreview(URL.createObjectURL(acceptedFiles[0]));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onProfileDrop,
    accept: { "image/png": [], "image/jpeg": [], "image/jpg": [], "image/gif": [] },
    maxSize: 1 * 1024 * 1024,
    multiple: false,
  });

  const removeProfileImage = () => { setImage(null); setPreview(null); };

  const validateTab1 = (): boolean => {
    const errs: Tab1Errors = {};
    if (!form.fullName.trim()) errs.fullName = "Full name is required.";
    if (!form.designation) errs.designation = "Designation is required.";
    if (!form.department) errs.department = "Department is required.";
    if (!form.gender) errs.gender = "Gender is required.";
    setTab1Errors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateTab2 = (): boolean => {
    const errs: Tab2Errors = {};
    if (!form.joiningDate) errs.joiningDate = "Date of joining is required.";
    if (!form.salary.basicSalary || Number(form.salary.basicSalary) <= 0)
      errs.basicSalary = "Basic salary is required.";
    setTab2Errors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateTab1()) { goToTab(1); return; }
    if (!validateTab2()) { goToTab(2); return; }

    setIsLoading(true);
    try {
      const formData = new FormData();

      Object.keys(form).forEach((key) => {
        if (key === "salary") {
          Object.keys(form.salary).forEach((sKey) => {
            formData.append(`salary[${sKey}]`, form.salary[sKey as keyof SalaryForm]);
          });
        } else if (key === "department") {
          // backend model field has a typo: "deapartment"
          formData.append("deapartment", form.department);
        } else {
          formData.append(key, form[key as keyof EmployeeForm] as string);
        }
      });

      certifications.forEach((cert, i) => {
        formData.append(`certifications[${i}][title]`, cert.title);
        formData.append(`certifications[${i}][institute]`, cert.institute);
        formData.append(`certifications[${i}][year]`, cert.year);
        formData.append(`certifications[${i}][details]`, cert.details);
        if (cert.imageFile) formData.append(`certImage_${i}`, cert.imageFile);
      });

      if (image) formData.append("image", image);

      await axiosSecure.put(
        `/employee/update-employee/${employeeIdCode}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      toast.success("Employee updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-edit", id] });
      queryClient.invalidateQueries({ queryKey: ["employee-view", id] });
      sessionStorage.removeItem(scopedStorageKey(`employee-edit-tab-${id}`));
      setTimeout(() => navigate("/employee-list"), 50);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to update employee.");
      } else {
        toast.error("Something went wrong.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 font-bold mb-4">Employee not found.</p>
        <button onClick={() => navigate("/employee-list")} className="shine px-6 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-bold">
          Back to List
        </button>
      </div>
    );
  }

  return (
    <>
      <PageMeta title={`Edit Employee — ${form.fullName}`} description="Edit employee details" />
      <PageBreadcrumb
        pageTitle="Edit Employee"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/employee-list">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Employee List
            </Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pb-10">
        <div className="xl:col-span-2 space-y-6">
          <SectionCard id="sec-personal" icon={<FaUser />} title="Personal Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col md:col-span-2">
              <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
              <Input type="text" placeholder="Enter Full Name" value={form.fullName}
                className={tab1Errors.fullName ? "border-red-500" : ""}
                onChange={(e) => { handleChange("fullName", e.target.value); setTab1Errors((p) => ({ ...p, fullName: undefined })); }}
              />
              {tab1Errors.fullName && <p className="text-red-500 text-xs mt-1">{tab1Errors.fullName}</p>}
            </div>
            <div className="flex flex-col">
              <Label>Gender <span className="text-red-500">*</span></Label>
              <SearchableSelect options={GENDERS} value={form.gender} hasError={!!tab1Errors.gender}
                placeholder="Select Gender" searchPlaceholder="Search gender..."
                onChange={(val) => { handleChange("gender", val); setTab1Errors((p) => ({ ...p, gender: undefined })); }}
              />
              {tab1Errors.gender && <p className="text-red-500 text-xs mt-1">{tab1Errors.gender}</p>}
            </div>
            <div className="flex flex-col">
              <DatePicker id="dob" label="Date Of Birth" placeholder="Select a date"
                defaultDate={form.dateOfBirth ? new Date(form.dateOfBirth) : undefined}
                onChange={(date: any) => handleChange("dateOfBirth", date)} />
            </div>
            <div className="flex flex-col">
              <Label>NID Number</Label>
              <Input type="text" placeholder="Enter NID Number" value={form.nidNumber}
                onChange={(e) => handleChange("nidNumber", e.target.value)} />
            </div>
            <div className="flex flex-col">
              <Label>Blood Group</Label>
              <Input type="text" placeholder="Enter Blood Group" value={form.bloodGroup}
                onChange={(e) => handleChange("bloodGroup", e.target.value)} />
            </div>
            <div className="flex flex-col">
              <Label>Religion</Label>
              <Input type="text" placeholder="Enter Religion" value={form.religion}
                onChange={(e) => handleChange("religion", e.target.value)} />
            </div>
            <div className="flex flex-col">
              <Label>Nationality</Label>
              <Input type="text" placeholder="Enter Nationality" value={form.nationality}
                onChange={(e) => handleChange("nationality", e.target.value)} />
            </div>
            <div className="flex flex-col">
              <Label>Father's Name</Label>
              <Input type="text" placeholder="Enter Father's Name" value={form.fathersName}
                onChange={(e) => handleChange("fathersName", e.target.value)} />
            </div>
            <div className="flex flex-col">
              <Label>Mother's Name</Label>
              <Input type="text" placeholder="Enter Mother's Name" value={form.mothersName}
                onChange={(e) => handleChange("mothersName", e.target.value)} />
            </div>
            <div className="flex flex-col md:col-span-2">
              <Label>Educational Qualification</Label>
              <Input type="text" placeholder="Enter Educational Qualification" value={form.educationalQualification}
                onChange={(e) => handleChange("educationalQualification", e.target.value)} />
            </div>
          </div>
          </SectionCard>

          <SectionCard id="sec-job" icon={<FaBriefcase />} title="Job & Organisation">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col">
              <Label>Designation <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableSelect options={designationList} value={form.designation} hasError={!!tab1Errors.designation}
                    placeholder="Select Designation" searchPlaceholder="Search designations..."
                    onChange={(val) => { handleChange("designation", val); setTab1Errors((p) => ({ ...p, designation: undefined })); }}
                  />
                </div>
                <button type="button" onClick={() => setQuickCreate("designation")}
                  className="shine shrink-0 size-11 flex items-center justify-center rounded-lg border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 transition-colors"
                  title="Add Designation" aria-label="Add designation">
                  <FaPlus className="size-3.5" />
                </button>
              </div>
              {tab1Errors.designation && <p className="text-red-500 text-xs mt-1">{tab1Errors.designation}</p>}
            </div>
            <div className="flex flex-col">
              <Label>Department <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableSelect options={departmentList} value={form.department} hasError={!!tab1Errors.department}
                    placeholder="Select Department" searchPlaceholder="Search departments..."
                    onChange={(val) => { handleChange("department", val); setTab1Errors((p) => ({ ...p, department: undefined })); }}
                  />
                </div>
                <button type="button" onClick={() => setQuickCreate("department")}
                  className="shine shrink-0 size-11 flex items-center justify-center rounded-lg border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 transition-colors"
                  title="Add Department" aria-label="Add department">
                  <FaPlus className="size-3.5" />
                </button>
              </div>
              {tab1Errors.department && <p className="text-red-500 text-xs mt-1">{tab1Errors.department}</p>}
            </div>
            <div className="flex flex-col">
              <Label>Section</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableSelect options={sectionList} value={form.section}
                    placeholder="Select Section" searchPlaceholder="Search sections..."
                    onChange={(val) => handleChange("section", val)} />
                </div>
                <button type="button" onClick={() => setQuickCreate("section")}
                  className="shine shrink-0 size-11 flex items-center justify-center rounded-lg border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 transition-colors"
                  title="Add Section" aria-label="Add section">
                  <FaPlus className="size-3.5" />
                </button>
              </div>
            </div>
            <div className="flex flex-col">
              <DatePicker id="joining" label="Date Of Joining *" placeholder="Select a date"
                defaultDate={form.joiningDate ? new Date(form.joiningDate) : new Date()}
                onChange={(date: any) => { handleChange("joiningDate", date); setTab2Errors((p) => ({ ...p, joiningDate: undefined })); }}
              />
              {tab2Errors.joiningDate && <p className="text-red-500 text-xs mt-1">{tab2Errors.joiningDate}</p>}
            </div>
          </div>
          </SectionCard>

          <SectionCard id="sec-contact" icon={<FaAddressBook />} title="Contact & Address">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col">
              <Label>Primary Mobile</Label>
              <Input type="text" placeholder="Enter Primary Mobile" value={form.mobile}
                onChange={(e) => handleChange("mobile", e.target.value)} />
            </div>
            <div className="flex flex-col">
              <Label>Secondary Mobile</Label>
              <Input type="text" placeholder="Enter Secondary Mobile" value={form.secondaryMobile}
                onChange={(e) => handleChange("secondaryMobile", e.target.value)} />
            </div>
            <div className="flex flex-col md:col-span-2">
              <Label>Email Address</Label>
              <Input type="email" placeholder="Enter Email Address" value={form.email}
                onChange={(e) => handleChange("email", e.target.value)} />
            </div>
            <div className="flex flex-col md:col-span-2">
              <Label>Present Address</Label>
              <Input type="text" placeholder="Enter Present Address" value={form.presentAddress}
                onChange={(e) => handleChange("presentAddress", e.target.value)} />
            </div>
            <div className="flex flex-col md:col-span-2">
              <Label>Permanent Address</Label>
              <Input type="text" placeholder="Enter Permanent Address" value={form.permanentAddress}
                onChange={(e) => handleChange("permanentAddress", e.target.value)} />
            </div>
          </div>
          </SectionCard>

          <SectionCard id="sec-salary" icon={<FaMoneyBillWave />} title="Salary & Payroll">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div className="flex flex-col">
              <Label>Basic Salary <span className="text-red-500">*</span></Label>
              <Input type="number" placeholder="Enter Basic Salary" value={form.salary.basicSalary}
                className={tab2Errors.basicSalary ? "border-red-500" : ""}
                onChange={(e) => { handleSalaryChange("basicSalary", e.target.value); setTab2Errors((p) => ({ ...p, basicSalary: undefined })); }}
              />
              {tab2Errors.basicSalary && <p className="text-red-500 text-xs mt-1">{tab2Errors.basicSalary}</p>}
            </div>
            <div className="flex flex-col">
              <Label>House Rent</Label>
              <Input type="number" placeholder="Enter House Rent" value={form.salary.houseRent}
                onChange={(e) => handleSalaryChange("houseRent", e.target.value)} />
            </div>
            <div className="flex flex-col">
              <Label>Medical Allowance</Label>
              <Input type="number" placeholder="Enter Medical Allowance" value={form.salary.medicalAllowance}
                onChange={(e) => handleSalaryChange("medicalAllowance", e.target.value)} />
            </div>
            <div className="flex flex-col">
              <Label>Others Allowance</Label>
              <Input type="number" placeholder="Enter Others Allowance" value={form.salary.othersAllowance}
                onChange={(e) => handleSalaryChange("othersAllowance", e.target.value)} />
            </div>
            <div className="flex flex-col">
              <Label>Special Allowance</Label>
              <Input type="number" placeholder="Enter Special Allowance" value={form.salary.specialAllowance}
                onChange={(e) => handleSalaryChange("specialAllowance", e.target.value)} />
            </div>
            <div className="flex flex-col">
              <Label>Provident Fund</Label>
              <Input type="number" placeholder="Enter Provident Fund" value={form.salary.providentFund}
                onChange={(e) => handleSalaryChange("providentFund", e.target.value)} />
            </div>
          </div>
          </SectionCard>

          <SectionCard id="sec-ref" icon={<FaUserFriends />} title="Reference & Notes">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col">
              <Label>Reference Person Name</Label>
              <Input type="text" placeholder="Enter Reference Person Name" value={form.referencePersonName}
                onChange={(e) => handleChange("referencePersonName", e.target.value)} />
            </div>
            <div className="flex flex-col">
              <Label>Reference Mobile</Label>
              <Input type="text" placeholder="Enter Reference Mobile" value={form.referenceMobile}
                onChange={(e) => handleChange("referenceMobile", e.target.value)} />
            </div>
            <div className="flex flex-col md:col-span-2">
              <Label>Reference Person Details</Label>
              <Input type="text" placeholder="Enter Reference Person Details" value={form.referencePersonDetails}
                onChange={(e) => handleChange("referencePersonDetails", e.target.value)} />
            </div>
                        <div className="flex flex-col md:col-span-2">
                          <Label>Comments</Label>
                          <textarea placeholder="Enter Comments" value={form.comments}
                            onChange={(e) => handleChange("comments", e.target.value)} rows={3}
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all resize-none"
                          />
                        </div>
          </div>
          </SectionCard>

          <SectionCard
            id="sec-certs"
            icon={<FaCertificate />}
            title={`Certifications (${certifications.length})`}
            action={
              <button type="button" onClick={addCertification} className="shine flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 text-xs font-semibold transition-colors">
                <FaPlus className="size-3" />
                Add Certificate
              </button>
            }
          >
          {certifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-4">No certifications added yet</p>
              <button type="button" onClick={addCertification}
                className="shine flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 text-xs font-semibold transition-colors">
                <FaPlus className="size-3" /> Add Certificate
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {certifications.map((cert, index) => (
                <div key={index} className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Certificate #{index + 1}
                    </span>
                    <button type="button" onClick={() => removeCertification(index)}
                      aria-label={`Remove certificate ${index + 1}`}
                      className="shine size-8 flex items-center justify-center rounded bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25 transition-all active:scale-90">
                      <MdDelete className="size-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <Label>Certificate Title</Label>
                      <Input type="text" placeholder="e.g. Bachelor of Science" value={cert.title}
                        onChange={(e) => handleCertChange(index, "title", e.target.value)} />
                    </div>
                    <div className="flex flex-col">
                      <Label>Institute</Label>
                      <Input type="text" placeholder="e.g. Dhaka University" value={cert.institute}
                        onChange={(e) => handleCertChange(index, "institute", e.target.value)} />
                    </div>
                    <div className="flex flex-col">
                      <Label>Year</Label>
                      <Input type="text" placeholder="e.g. 2020" value={cert.year}
                        onChange={(e) => handleCertChange(index, "year", e.target.value)} />
                    </div>
                    <div className="flex flex-col">
                      <Label>Details</Label>
                      <Input type="text" placeholder="Additional details" value={cert.details}
                        onChange={(e) => handleCertChange(index, "details", e.target.value)} />
                    </div>
                    <div className="md:col-span-2 flex flex-col">
                      <Label>Certificate Image</Label>
                      <CertImageDropzone index={index} preview={cert.imagePreview}
                        onDrop={handleCertImageDrop} onRemove={handleCertImageRemove} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </SectionCard>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-24 self-start">
          <SectionCard id="sec-photo" icon={<FaCamera />} title="Photo">
          <div className="flex flex-col gap-2">
                              {preview ? (
              <div className="flex flex-col items-center gap-4">
                <img src={preview} alt="Employee preview" className="size-40 rounded-2xl object-cover border border-gray-200 dark:border-gray-700" />
                <button type="button" onClick={removeProfileImage}
                  className="shine flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 text-sm font-medium transition-colors">
                  <MdDelete className="size-4" /> Remove Photo
                </button>
              </div>
            ) : (
              <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-150 ${
                isDragActive ? "border-accent-500 bg-accent-50 dark:bg-accent-500/10" : "border-gray-300 dark:border-gray-600 hover:border-accent-400 bg-gray-50 dark:bg-gray-800/50"
              }`}>
                <input {...getInputProps()} />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isDragActive ? "Drop the photo here..." : "Drag & drop a photo here, or click to select"}
                </p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF — max 1MB</p>
              </div>
            )}
          </div>
          </SectionCard>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-theme-sm">
            <MobileActionBar>
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full !bg-accent-500 hover:!bg-accent-600 !text-white font-semibold py-3 !rounded-xl disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving…
                  </span>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </MobileActionBar>
          </div>
        </aside>
      </div>

      <QuickCreateModal
        type={quickCreate ?? "designation"}
        isOpen={quickCreate !== null}
        onClose={() => setQuickCreate(null)}
        onCreated={(item) => {
          if (quickCreate === "designation") {
            setDesignationList((prev) => [...prev, { label: item.name, value: item._id }]);
            handleChange("designation", item._id);
            queryClient.invalidateQueries({ queryKey: ["designations"] });
          } else if (quickCreate === "department") {
            setDepartmentList((prev) => [...prev, { label: item.name, value: item._id }]);
            handleChange("department", item._id);
            queryClient.invalidateQueries({ queryKey: ["departments"] });
          } else if (quickCreate === "section") {
            setSectionList((prev) => [...prev, { label: item.name, value: item._id }]);
            handleChange("section", item._id);
            queryClient.invalidateQueries({ queryKey: ["sections"] });
          }
          setQuickCreate(null);
        }}
      />
    </>
  );
};

export default EmployeeEdit;
