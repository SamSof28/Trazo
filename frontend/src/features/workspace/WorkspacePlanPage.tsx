import React from 'react';
import { useParams } from 'react-router-dom';

export const WorkspacePlanPage: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();

  return (
    <div className="p-8">
      <h1 className="font-heading font-extrabold text-2xl mb-2">Workspace Plan</h1>
      <p className="text-muted text-sm">Plan: {planId}</p>
    </div>
  );
};
