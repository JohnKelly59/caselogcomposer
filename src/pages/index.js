// pages/index.js
import { useSession, signIn, signOut } from "next-auth/react";
import { AppBar, Toolbar, Typography, Button, Container, Box, Paper, CssBaseline } from "@mui/material";
import Sidebar from "../components/Sidebar";

export default function Dashboard ()
{
  const { data: session, status } = useSession();

  if (status === "loading")
  {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  if (!session)
  {
    return (
      <Container
        maxWidth="sm"
        sx={{
          mt: 8,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh"
        }}
      >
        <Paper elevation={3} sx={{ p: 6, borderRadius: 2 }}>
          <Typography variant="h5" align="center" gutterBottom>
            Welcome to the Clerkship Case Log Portal
          </Typography>
          <Typography variant="body1" align="center" sx={{ mb: 4 }}>
            Please sign in with your Google account to access and manage your case logs.
          </Typography>
          <Box display="flex" justifyContent="center">
            <Button
              variant="contained"
              size="large"
              color="primary"
              onClick={() => signIn("google")}
            >
              Sign in with Google
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <Sidebar />
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh" }}
      >
        <Toolbar />
        <Paper sx={{ p: 4, mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Welcome, {session.user.name}!
          </Typography>
          <Typography variant="body1">
            Compose, upload and manage your clerkship case logs with ease.
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
