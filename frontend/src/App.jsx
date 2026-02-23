import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Success from './pages/Success';
import Access from './pages/Access';
import NearbyShops from './pages/NearbyShops';
import Navbar from './components/Navbar';

function App() {
    return (
        <Router>
            <div className="bg-circuit"></div>
            <Navbar />
            <main>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/success/:code/:expiry" element={<Success />} />
                    <Route path="/access" element={<Access />} />
                    <Route path="/nearby-shops" element={<NearbyShops />} />
                </Routes>
            </main>
        </Router>
    );
}

export default App;
