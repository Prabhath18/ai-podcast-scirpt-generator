import { ThemeProvider } from './hooks/useTheme.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import { AuthProvider } from './hooks/useAuth.jsx';

/** The app's context providers, in one place so tests mount exactly what production does. Must sit inside a Router. */
export default function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
