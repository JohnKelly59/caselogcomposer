// pages/index.js
import { useSession, signIn, signOut } from "next-auth/react";
import { Container, Typography, Button, Box, Paper } from "@mui/material";
import Link from "next/link";

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <Container maxWidth="md" sx={{ mt: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Box textAlign="center" mb={4}>
          <Typography variant="h3" component="h1" gutterBottom>
            Case Log Composer
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Compose, upload and manage your clerkship case logs with ease.
          </Typography>
        </Box>

        {status === "loading" ? (
          <Typography>Loading...</Typography>
        ) : session ? (
          <>
            <Box textAlign="center" mb={4}>
              <Typography variant="h6" gutterBottom>
                Welcome, {session.user.name}!
              </Typography>
              <Button variant="contained" color="secondary" onClick={() => signOut()}>
                Sign Out
              </Button>
            </Box>
            <Box textAlign="center">
              <Link href="/upload" passHref>
                <Button variant="contained" color="primary" size="large">
                  Go to Upload Page
                </Button>
              </Link>
            </Box>
          </>
        ) : (
          <Box textAlign="center">
            <Typography variant="h6" gutterBottom>
              You are not signed in.
            </Typography>
            <Button variant="contained" color="primary" onClick={() => signIn("google")}>
              Sign In with Google
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
