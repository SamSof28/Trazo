import React from 'react';
import { useParams } from 'react-router-dom';

export const WorkspaceIntakePage: React.FC = () => {
  const { tripRequestId } = useParams<{ tripRequestId: string }>();

  return (
    <div className="p-8">
      <h1 className="font-heading font-extrabold text-2xl mb-2">Workspace Intake</h1>
      <p className="text-muted text-sm">Solicitud: {tripRequestId}</p>
    </div>
  );
};
