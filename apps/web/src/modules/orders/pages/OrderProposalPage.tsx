import { ArrowLeft, FileText } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export default function OrderProposalPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => navigate(`/orders/${id}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={20} />
          Powrót do zlecenia
        </button>
      </div>
      <div className="max-w-3xl mx-auto bg-surface rounded-xl border border-border p-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 mb-2">
          <FileText size={20} />
          <h1 className="text-lg font-bold text-foreground">Proposal (w przygotowaniu)</h1>
        </div>
        <p>
          Ta podstrona będzie obsługiwać dedykowany dokument typu <strong>Proposal</strong> powiązany ze zleceniem.
          Core danych i numeracja są przygotowane w backendzie; szablon i szczegółowy formularz zostaną dodane w kolejnych krokach.
        </p>
      </div>
    </div>
  );
}

