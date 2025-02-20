// components/Sidebar.js
import Link from "next/link";
import
{
    AppBar,
    Toolbar,
    Typography,
    Button,
    Drawer,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    CssBaseline,
    Box,
} from "@mui/material";
import { signOut } from "next-auth/react";
import DashboardIcon from "@mui/icons-material/Dashboard";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

const drawerWidth = 240;

export default function Sidebar ()
{
    return (
        <Box sx={{ display: "flex" }}>
            <CssBaseline />
            {/* Top AppBar integrated into Sidebar */}
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Case Log Composer Dashboard
                    </Typography>
                    <Button color="inherit" onClick={() => signOut()}>
                        Sign Out
                    </Button>
                </Toolbar>
            </AppBar>

            {/* Sidebar Drawer */}
            <Drawer
                variant="permanent"
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: "border-box" },
                }}
            >
                <Toolbar />
                {/* Sidebar Header */}

                <Box sx={{ overflow: "auto" }}>
                    <List>
                        <Link href="/" passHref>
                            <ListItem button component="a">
                                <ListItemIcon>
                                    <DashboardIcon />
                                </ListItemIcon>
                                <ListItemText primary="Dashboard" />
                            </ListItem>
                        </Link>
                        <Link href="/upload" passHref>
                            <ListItem button component="a">
                                <ListItemIcon>
                                    <CloudUploadIcon />
                                </ListItemIcon>
                                <ListItemText primary="Upload" />
                            </ListItem>
                        </Link>
                        {/* Add more navigation items here */}
                    </List>
                </Box>
            </Drawer>
        </Box>
    );
}
