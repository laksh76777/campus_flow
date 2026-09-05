import Navbar from "./Navbar.jsx";
import Home from "./Home.jsx";
import ProcessWorkflow from "./ProcessWorkflow.jsx";
import PreviousDrives from "./PreviousDrives.jsx";
import TopRecruitingCompanies from "./TopRecuritingCompanies.jsx";
import Contact from "./Contact.jsx";
import Footer from "./Footer.jsx";

function IndexHome() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main>
        <Home />
        <ProcessWorkflow />
        <PreviousDrives />
        <TopRecruitingCompanies />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

export default IndexHome;