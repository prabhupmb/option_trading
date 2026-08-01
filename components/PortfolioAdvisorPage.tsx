import React, { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import AddToPortfolio from './AddToPortfolio';
import PortfolioAdvisor from './PortfolioAdvisor';

interface PortfolioAdvisorPageProps {
  userId: string;
}

const PortfolioAdvisorPage: React.FC<PortfolioAdvisorPageProps> = ({ userId }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleChange = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <AddToPortfolio supabase={supabase} userId={userId} onChange={handleChange} />
      <PortfolioAdvisor supabase={supabase} userId={userId} refreshKey={refreshKey} />
    </div>
  );
};

export default PortfolioAdvisorPage;
