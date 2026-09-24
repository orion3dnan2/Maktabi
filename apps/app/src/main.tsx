import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@maktabi/ui/styles.css';
import './styles/app.css';
import App from './App';

document.documentElement.lang = 'ar';
document.documentElement.dir = 'rtl';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
