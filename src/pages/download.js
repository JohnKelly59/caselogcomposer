import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Container, Button, Typography, List, ListItem, Link as MuiLink, Paper } from '@mui/material';

export default function DownloadPage() {
  const { data: session, status } = useSession();
  const [pdfUrls, setPdfUrls] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status !== 'loading' && session) {
      fetch('/api/list-pdfs')
        .then((res) => res.json())
        .then((data) => {
          if (data.urls && data.urls.length > 0) {
            setPdfUrls(data.urls);
          } else {
            setMessage('No PDFs available.');
          }
        })
        .catch((err) => {
          console.error('Error fetching PDF URLs:', err);
          setMessage('Failed to load PDFs.');
        });
    }
  }, [session, status]);

  if (status === 'loading') return <Typography>Loading...</Typography>;
  if (!session) return <Typography>You must be signed in to view this page.</Typography>;

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Download Your Generated PDFs
        </Typography>
        {pdfUrls.length > 0 ? (
          <List>
            {pdfUrls.map((url, index) => (
              <ListItem key={index}>
                <MuiLink href={url} target="_blank" rel="noopener noreferrer">
                  Download PDF {index + 1}
                </MuiLink>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography>{message}</Typography>
        )}
        <Button variant="contained" color="primary" onClick={() => window.location.reload()} sx={{ mt: 2 }}>
          Refresh List
        </Button>
      </Paper>
    </Container>
  );
}
