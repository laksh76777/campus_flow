import Navbar from "./Navbar.jsx";
import Home from "./Home.jsx";
import PlatformFeatures from "./PlatformFeatures.jsx";
import ProcessWorkflow from "./ProcessWorkflow.jsx";
import Footer from "./Footer.jsx";

function IndexHome() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main>
        <Home />
        <PlatformFeatures />
        <ProcessWorkflow />
      </main>
      <Footer />
    </div>
  );
}

export default IndexHome;