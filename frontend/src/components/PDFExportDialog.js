import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FileText, Loader2 } from 'lucide-react';

const STORAGE_KEY = 'pdf_export_preference';

export const PDFExportDialog = ({ open, onClose, onExport }) => {
  const [exportType, setExportType] = useState('without-prices');
  const [isExporting, setIsExporting] = useState(false);

  // Load saved preference
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setExportType(saved);
    }
  }, []);

  // Save preference when changed
  const handleTypeChange = (value) => {
    setExportType(value);
    localStorage.setItem(STORAGE_KEY, value);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const includePrices = exportType === 'with-prices';
      await onExport(includePrices);
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="pdf-export-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Vie PDF
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={exportType} onValueChange={handleTypeChange} className="space-y-3">
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="without-prices" id="without-prices" className="mt-1" />
              <Label htmlFor="without-prices" className="cursor-pointer flex-1">
                <div className="font-medium">Ilman hintoja</div>
                <div className="text-sm text-gray-500">Määrälaskenta - vain tyyppi, määrä ja yksikkö</div>
              </Label>
            </div>
            
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="with-prices" id="with-prices" className="mt-1" />
              <Label htmlFor="with-prices" className="cursor-pointer flex-1">
                <div className="font-medium">Hinnat mukana</div>
                <div className="text-sm text-gray-500">Määrä- ja kustannuslaskenta - sisältää hinnat ja ALV</div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Peruuta
          </Button>
          <Button onClick={handleExport} disabled={isExporting} data-testid="create-pdf-btn">
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Luodaan...
              </>
            ) : (
              'Luo PDF'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
