// pages/auth/signin.js
import { signIn } from "next-auth/react";
import { Container, Button, Typography, Box } from "@mui/material";

export default function SignIn() {
  console.log("NextAuth Secret:", process.env.NEXTAUTH_SECRET ? "Loaded" : "Not Loaded");
  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          p: 4,
          boxShadow: 3,
          borderRadius: 2,
        }}
      >
        <Typography variant="h4" gutterBottom>
          Sign In
        </Typography>
        <Typography variant="body1" gutterBottom>
          Sign in with your Google account to continue.
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => signIn("google")}
          sx={{ mt: 3 }}
        >
          Sign in with Google
        </Button>
      </Box>
    </Container>
  );
}
