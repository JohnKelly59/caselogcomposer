import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { Container, TextField, Button, Typography, Box, Paper } from "@mui/material";

export default function UploadPage() {
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

  // Redirect unauthenticated users to the sign-in page.
  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push("/auth/signin");
    }
  }, [session, status, router]);

  if (status === "loading" || !session) return <Typography>Loading...</Typography>;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setMessage("Please select an XLSX file.");
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

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Processing complete. ${data.message}`);
        setDownloadReady(true); // Show the download button
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
      setMessage("An error occurred while uploading the file.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleDownload() {
    try {
      setIsDownloading(true);          // Start the "downloading" state
      const response = await fetch(
        `/api/list-pdfs?userName=${encodeURIComponent(session.user.name)}`
      );

      if (!response.ok) {
        throw new Error("Failed to get presigned URL");
      }

      const { url } = await response.json();
      // Download the ZIP directly from S3
      window.location.href = url;
    } catch (error) {
      console.error("Error downloading ZIP:", error);
      alert("Could not download ZIP file");
    } finally {
      setIsDownloading(false);         // End the "downloading" state
    }
  }

  return (
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

            {/* Date input */}
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

            <Button variant="contained" color="primary" type="submit" disabled={processing}>
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
  );
}
