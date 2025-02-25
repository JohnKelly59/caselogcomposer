import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import
{
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  Toolbar,
  Snackbar,
  Alert,
} from "@mui/material";
import Sidebar from "../components/Sidebar";

export default function UploadPage ()
{
  const { data: session, status } = useSession();
  const router = useRouter();

  const [studentName, setStudentName] = useState("");
  const [hospital, setHospital] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [clerkship, setClerkship] = useState("");
  const [coursePrefix, setCoursePrefix] = useState("");
  const [file, setFile] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);

  // New state to track the download process
  const [isDownloading, setIsDownloading] = useState(false);

  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() =>
  {
    if (status !== "loading" && !session)
    {
      router.push("/auth/signin");
    }
  }, [session, status, router]);

  if (status === "loading" || !session)
    return <Typography>Loading...</Typography>;

  const handleToastClose = (event, reason) =>
  {
    if (reason === "clickaway")
    {
      return;
    }
    setToast({ ...toast, open: false });
  };

  async function handleSubmit (e)
  {
    e.preventDefault();
    if (!file)
    {
      setToast({
        open: true,
        severity: "error",
        message: "Please select an XLSX file.",
      });
      return;
    }
    setProcessing(true);
    setMessage("");
    setDownloadReady(false);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("studentName", studentName);
    formData.append("hospital", hospital);
    formData.append("supervisor", supervisor);
    formData.append("clerkship", clerkship);
    formData.append("coursePrefix", coursePrefix);
    formData.append("date", selectedDate);
    formData.append("userName", session.user.name || "UnknownUser");

    try
    {
      const res = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok)
      {
        setMessage(`Processing complete. ${data.message}`);
        setDownloadReady(true);
        setToast({
          open: true,
          severity: "success",
          message: `Processing complete. ${data.message}`,
        });
      } else
      {
        setMessage(`Error: ${data.error}`);
        setToast({
          open: true,
          severity: "error",
          message: `Error: ${data.error}`,
        });
      }
    } catch (error)
    {
      console.error(error);
      setMessage("An error occurred while uploading the file.");
      setToast({
        open: true,
        severity: "error",
        message: "An error occurred while uploading the file.",
      });
    } finally
    {
      setProcessing(false);
    }
  }

  async function handleDownload ()
  {
    try
    {
      setIsDownloading(true);
      const response = await fetch(
        `/api/list-pdfs?userName=${encodeURIComponent(session.user.name)}`
      );

      if (!response.ok)
      {
        throw new Error("Failed to get presigned URL");
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error)
    {
      console.error("Error downloading ZIP:", error);
      alert("Could not download ZIP file");
    } finally
    {
      setIsDownloading(false);
    }
  }

  return (
    <Box sx={{ display: "flex" }}>
      <Sidebar />
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh" }}
      >
        <Toolbar />
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Paper sx={{ p: 4, mb: 4 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h4">Upload Case Logs XLSX</Typography>
              <Button variant="outlined" onClick={() => signOut()}>
                Sign Out
              </Button>
            </Box>
          </Paper>

          <Paper sx={{ p: 4 }}>
            <form onSubmit={handleSubmit} encType="multipart/form-data">
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField
                  label="Student Name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  required
                />
                <TextField
                  label="Hospital/Clinical Site"
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  required
                />
                <TextField
                  label="Supervising Faculty"
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                  required
                />
                <TextField
                  label="Clerkship Name"
                  value={clerkship}
                  onChange={(e) => setClerkship(e.target.value)}
                  required
                />
                <TextField
                  label="Course Prefix"
                  value={coursePrefix}
                  onChange={(e) => setCoursePrefix(e.target.value)}
                  required
                />
                <Box>
                  <label htmlFor="date-picker">
                    <Typography>Select Date</Typography>
                  </label>
                  <input
                    id="date-picker"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    required
                  />
                </Box>

                {file ? (
                  <Typography variant="body1">Selected File: {file.name}</Typography>
                ) : (
                  <Button variant="contained" component="label">
                    Select XLSX File
                    <input
                      type="file"
                      accept=".xlsx"
                      hidden
                      onChange={(e) => setFile(e.target.files[0])}
                      required
                    />
                  </Button>
                )}

                <Button
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={processing}
                >
                  {processing ? "Processing..." : "Upload and Process"}
                </Button>

                {downloadReady && (
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleDownload}
                    disabled={isDownloading}
                  >
                    {isDownloading ? "Downloading..." : "Download Your PDFs"}
                  </Button>
                )}
              </Box>
            </form>
            {message && (
              <Typography variant="body1" sx={{ mt: 2 }}>
                {message}
              </Typography>
            )}
          </Paper>
        </Container>
        <Snackbar
          open={toast.open}
          autoHideDuration={6000}
          onClose={handleToastClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={handleToastClose}
            severity={toast.severity}
            sx={{ width: "100%" }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
}
