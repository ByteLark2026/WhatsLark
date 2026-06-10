'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Trash2, Image as ImageIcon, Video, FileText, MapPin, Copy, ExternalLink,
  Phone, MessageSquare, ShoppingBag, Clock, Loader2, Info, PhoneCall,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import type { MessageTemplate, TemplateComponent, TemplateButton } from '@whatslark/shared';

export type TemplateType =
  | 'CUSTOM'
  | 'COUPON_CODE'
  | 'LIMITED_TIME_OFFER'
  | 'MEDIA_CARD_CAROUSEL'
  | 'PRODUCT_CARD_CAROUSEL'
  | 'CATALOG'
  | 'MULTI_PRODUCT'
  | 'SINGLE_PRODUCT'
  | 'CALL_PERMISSION_REQUEST';

const TEMPLATE_TYPES: { value: TemplateType; label: string; description: string; needsCatalog?: boolean }[] = [
  { value: 'CUSTOM', label: 'Custom', description: 'Free-form text with optional header, footer and buttons.' },
  { value: 'COUPON_CODE', label: 'Coupon Code', description: 'Adds a tap-to-copy coupon code button.' },
  { value: 'LIMITED_TIME_OFFER', label: 'Limited-Time Offer', description: 'Highlights a deal with an optional expiration countdown.' },
  { value: 'MEDIA_CARD_CAROUSEL', label: 'Media Card Carousel', description: 'Up to 10 swipeable cards with image/video and text.' },
  { value: 'PRODUCT_CARD_CAROUSEL', label: 'Product Card Carousel', description: 'Carousel of cards linked to catalog products.', needsCatalog: true },
  { value: 'CATALOG', label: 'Catalog', description: 'Lets customers browse your connected product catalog.', needsCatalog: true },
  { value: 'MULTI_PRODUCT', label: 'Multi-Product Message', description: 'Showcase several products from your catalog.', needsCatalog: true },
  { value: 'SINGLE_PRODUCT', label: 'Single-Product Message', description: 'Promote a single catalog product.', needsCatalog: true },
  { value: 'CALL_PERMISSION_REQUEST', label: 'Call Permission Request', description: 'Ask customers for permission to call them.' },
];

const CAROUSEL_TYPES: TemplateType[] = ['MEDIA_CARD_CAROUSEL', 'PRODUCT_CARD_CAROUSEL'];
const HEADERLESS_TYPES: TemplateType[] = [...CAROUSEL_TYPES];
const NO_EXTRA_BUTTONS_TYPES: TemplateType[] = ['CALL_PERMISSION_REQUEST', 'CATALOG', 'MULTI_PRODUCT', 'SINGLE_PRODUCT', ...CAROUSEL_TYPES];

const LANGUAGES = ['en', 'ms', 'id', 'th', 'ar', 'es', 'pt', 'fr', 'de', 'zh'];
const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];

interface ButtonForm {
  type: TemplateButton['type'];
  text: string;
  url?: string;
  phone_number?: string;
  example?: string;
}

interface CardForm {
  headerFormat: 'IMAGE' | 'VIDEO';
  headerMediaUrl: string;
  body: string;
  buttons: ButtonForm[];
  productRetailerId: string;
}

export interface TemplateFormState {
  name: string;
  language: string;
  category: string;
  templateType: TemplateType;
  headerFormat: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  headerText: string;
  headerMediaUrl: string;
  body: string;
  footer: string;
  buttons: ButtonForm[];
  limitedTimeOfferText: string;
  hasExpiration: boolean;
  couponCode: string;
  catalogId: string;
  productRetailerId: string;
  cards: CardForm[];
}

const blankCard = (): CardForm => ({ headerFormat: 'IMAGE', headerMediaUrl: '', body: '', buttons: [], productRetailerId: '' });

export const blankTemplateForm = (): TemplateFormState => ({
  name: '',
  language: 'en',
  category: 'MARKETING',
  templateType: 'CUSTOM',
  headerFormat: 'NONE',
  headerText: '',
  headerMediaUrl: '',
  body: '',
  footer: '',
  buttons: [],
  limitedTimeOfferText: '',
  hasExpiration: true,
  couponCode: '',
  catalogId: '',
  productRetailerId: '',
  cards: [],
});

function toButtonForm(b: TemplateButton): ButtonForm {
  return { type: b.type, text: b.text, url: b.url, phone_number: b.phone_number, example: b.example };
}

function fromButtonForm(b: ButtonForm): TemplateButton {
  const out: TemplateButton = { type: b.type, text: b.text.trim() };
  if (b.type === 'URL') out.url = b.url?.trim() || undefined;
  if (b.type === 'PHONE_NUMBER') out.phone_number = b.phone_number?.trim() || undefined;
  if (b.type === 'COPY_CODE') out.example = b.example?.trim() || undefined;
  return out;
}

export function parseTemplateToForm(tpl: MessageTemplate): TemplateFormState {
  const form = blankTemplateForm();
  form.name = tpl.name;
  form.language = tpl.language;
  form.category = tpl.category;

  const components = tpl.components || [];
  const header = components.find((c) => c.type === 'HEADER');
  const body = components.find((c) => c.type === 'BODY');
  const footer = components.find((c) => c.type === 'FOOTER');
  const buttonsComp = components.find((c) => c.type === 'BUTTONS');
  const lto = components.find((c) => c.type === 'LIMITED_TIME_OFFER');
  const carousel = components.find((c) => c.type === 'CAROUSEL');

  if (header) {
    form.headerFormat = (header.format || 'TEXT') as TemplateFormState['headerFormat'];
    if (form.headerFormat === 'TEXT') form.headerText = header.text || '';
    else if (form.headerFormat !== 'LOCATION') form.headerMediaUrl = header.text || '';
  }
  if (body) form.body = body.text || '';
  if (footer) form.footer = footer.text || '';

  const buttons = (buttonsComp?.buttons || []) as TemplateButton[];

  if (lto) {
    form.templateType = 'LIMITED_TIME_OFFER';
    form.limitedTimeOfferText = lto.limited_time_offer?.text || '';
    form.hasExpiration = lto.limited_time_offer?.has_expiration ?? true;
    form.buttons = buttons.map(toButtonForm);
  } else if (carousel) {
    const isProduct = (carousel.cards || []).some((c) => c.product_retailer_id);
    form.templateType = isProduct ? 'PRODUCT_CARD_CAROUSEL' : 'MEDIA_CARD_CAROUSEL';
    form.cards = (carousel.cards || []).map((card) => {
      const h = card.components.find((c) => c.type === 'HEADER');
      const b = card.components.find((c) => c.type === 'BODY');
      const btns = card.components.find((c) => c.type === 'BUTTONS');
      return {
        headerFormat: (h?.format as 'IMAGE' | 'VIDEO') || 'IMAGE',
        headerMediaUrl: h?.text || '',
        body: b?.text || '',
        buttons: (btns?.buttons || []).map(toButtonForm),
        productRetailerId: card.product_retailer_id || '',
      };
    });
    if (form.cards.length === 0) form.cards = [blankCard()];
  } else {
    const catalogBtn = buttons.find((b) => b.type === 'CATALOG');
    const mpmBtn = buttons.find((b) => b.type === 'MPM');
    const spmBtn = buttons.find((b) => b.type === 'SPM');
    const callBtn = buttons.find((b) => b.type === 'VOICE_CALL');
    const copyBtn = buttons.find((b) => b.type === 'COPY_CODE');

    if (catalogBtn) {
      form.templateType = 'CATALOG';
      form.catalogId = catalogBtn.catalog_id || '';
    } else if (mpmBtn) {
      form.templateType = 'MULTI_PRODUCT';
      form.catalogId = mpmBtn.catalog_id || '';
      form.productRetailerId = (mpmBtn.sections?.[0]?.product_retailer_ids || []).join(', ');
    } else if (spmBtn) {
      form.templateType = 'SINGLE_PRODUCT';
      form.catalogId = spmBtn.catalog_id || '';
      form.productRetailerId = spmBtn.product_retailer_id || '';
    } else if (callBtn) {
      form.templateType = 'CALL_PERMISSION_REQUEST';
      form.buttons = buttons.filter((b) => b.type !== 'VOICE_CALL').map(toButtonForm);
    } else if (copyBtn) {
      form.templateType = 'COUPON_CODE';
      form.couponCode = copyBtn.example || '';
      form.buttons = buttons.filter((b) => b.type !== 'COPY_CODE').map(toButtonForm);
    } else {
      form.templateType = 'CUSTOM';
      form.buttons = buttons.map(toButtonForm);
    }
  }

  return form;
}

export function buildComponentsFromForm(form: TemplateFormState): TemplateComponent[] {
  const components: TemplateComponent[] = [];

  if (!CAROUSEL_TYPES.includes(form.templateType) && form.headerFormat !== 'NONE') {
    if (form.headerFormat === 'TEXT') {
      if (form.headerText.trim()) components.push({ type: 'HEADER', format: 'TEXT', text: form.headerText.trim() });
    } else if (form.headerFormat === 'LOCATION') {
      components.push({ type: 'HEADER', format: 'LOCATION' });
    } else {
      components.push({ type: 'HEADER', format: form.headerFormat, text: form.headerMediaUrl.trim() || undefined });
    }
  }

  components.push({ type: 'BODY', text: form.body.trim() });

  if (!CAROUSEL_TYPES.includes(form.templateType) && form.footer.trim()) {
    components.push({ type: 'FOOTER', text: form.footer.trim() });
  }

  if (form.templateType === 'LIMITED_TIME_OFFER') {
    components.push({
      type: 'LIMITED_TIME_OFFER',
      limited_time_offer: { text: form.limitedTimeOfferText.trim() || 'Limited time offer', has_expiration: form.hasExpiration },
    });
  }

  let buttons: TemplateButton[] = form.buttons.filter((b) => b.text.trim()).map(fromButtonForm);

  switch (form.templateType) {
    case 'COUPON_CODE':
      buttons = [{ type: 'COPY_CODE', text: 'Copy code', example: form.couponCode.trim() || undefined }, ...buttons];
      break;
    case 'CALL_PERMISSION_REQUEST':
      buttons = [{ type: 'VOICE_CALL', text: 'Allow call request' }, ...buttons];
      break;
    case 'CATALOG':
      buttons = [{ type: 'CATALOG', text: 'View catalog', catalog_id: form.catalogId.trim() || undefined }];
      break;
    case 'MULTI_PRODUCT':
      buttons = [{
        type: 'MPM',
        text: 'View items',
        catalog_id: form.catalogId.trim() || undefined,
        sections: [{
          title: 'Featured products',
          product_retailer_ids: form.productRetailerId.split(',').map((s) => s.trim()).filter(Boolean),
        }],
      }];
      break;
    case 'SINGLE_PRODUCT':
      buttons = [{
        type: 'SPM',
        text: 'View product',
        catalog_id: form.catalogId.trim() || undefined,
        product_retailer_id: form.productRetailerId.trim() || undefined,
      }];
      break;
    default:
      break;
  }

  if (buttons.length) components.push({ type: 'BUTTONS', buttons });

  if (CAROUSEL_TYPES.includes(form.templateType)) {
    components.push({
      type: 'CAROUSEL',
      cards: form.cards.map((card) => {
        const cardComponents: TemplateComponent[] = [
          { type: 'HEADER', format: card.headerFormat, text: card.headerMediaUrl.trim() || undefined },
          { type: 'BODY', text: card.body.trim() },
        ];
        const cardButtons = card.buttons.filter((b) => b.text.trim()).map(fromButtonForm);
        if (cardButtons.length) cardComponents.push({ type: 'BUTTONS', buttons: cardButtons });
        return {
          components: cardComponents,
          ...(form.templateType === 'PRODUCT_CARD_CAROUSEL' && card.productRetailerId.trim()
            ? { product_retailer_id: card.productRetailerId.trim() }
            : {}),
        };
      }),
    });
  }

  return components;
}

export function isTemplateFormValid(form: TemplateFormState): boolean {
  if (!form.name.trim() || !form.body.trim()) return false;
  if (CAROUSEL_TYPES.includes(form.templateType)) {
    return form.cards.length > 0 && form.cards.every((c) => c.body.trim());
  }
  if (form.templateType === 'CATALOG' || form.templateType === 'MULTI_PRODUCT' || form.templateType === 'SINGLE_PRODUCT') {
    return !!form.catalogId.trim();
  }
  return true;
}

// ---------------- Sub-components ----------------

const BUTTON_ICONS: Record<TemplateButton['type'], any> = {
  QUICK_REPLY: MessageSquare,
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
  COPY_CODE: Copy,
  CATALOG: ShoppingBag,
  MPM: ShoppingBag,
  SPM: ShoppingBag,
  VOICE_CALL: PhoneCall,
};

function ButtonsEditor({
  buttons, onChange, allowedTypes, max,
}: {
  buttons: ButtonForm[];
  onChange: (buttons: ButtonForm[]) => void;
  allowedTypes: TemplateButton['type'][];
  max: number;
}) {
  const update = (i: number, patch: Partial<ButtonForm>) => {
    onChange(buttons.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  };
  const remove = (i: number) => onChange(buttons.filter((_, idx) => idx !== i));
  const add = () => onChange([...buttons, { type: allowedTypes[0], text: '' }]);

  return (
    <div className="space-y-2">
      {buttons.map((btn, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border p-2">
          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Select value={btn.type} onValueChange={(v) => update(i, { type: v as TemplateButton['type'] })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedTypes.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input className="h-8 text-xs" placeholder="Button text" value={btn.text} onChange={(e) => update(i, { text: e.target.value })} />
            </div>
            {btn.type === 'URL' && (
              <Input className="h-8 text-xs" placeholder="https://example.com/{{1}}" value={btn.url || ''} onChange={(e) => update(i, { url: e.target.value })} />
            )}
            {btn.type === 'PHONE_NUMBER' && (
              <Input className="h-8 text-xs" placeholder="+1 234 567 8900" value={btn.phone_number || ''} onChange={(e) => update(i, { phone_number: e.target.value })} />
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(i)}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      {buttons.length < max && (
        <Button variant="outline" size="sm" className="w-full" onClick={add}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />Add button
        </Button>
      )}
    </div>
  );
}

const ACCEPT_BY_FORMAT: Record<string, string> = {
  IMAGE: 'image/*',
  VIDEO: 'video/*',
  DOCUMENT: '.pdf,.doc,.docx',
};

function MediaUploadField({ format, value, onChange }: { format: string; value: string; onChange: (url: string) => void }) {
  const { company } = useAuthStore();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const fileName = value ? decodeURIComponent(value.split('/').pop() || '') : 'No file chosen';

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !company?.id) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${company.id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const { error } = await supabase.storage.from('template-media').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('template-media').getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs font-normal text-muted-foreground">Upload Sample Media</Label>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild disabled={uploading}>
          <label className="cursor-pointer">
            {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Choose File
            <input type="file" className="hidden" accept={ACCEPT_BY_FORMAT[format]} onChange={handleFile} disabled={uploading} />
          </label>
        </Button>
        <span className="text-xs text-muted-foreground truncate">{fileName}</span>
      </div>
      <p className="text-xs text-muted-foreground">Required for Meta template review</p>
    </div>
  );
}

function CardEditor({ card, onChange, onRemove, productMode }: { card: CardForm; onChange: (c: CardForm) => void; onRemove: () => void; productMode: boolean }) {
  return (
    <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <Select value={card.headerFormat} onValueChange={(v) => onChange({ ...card, headerFormat: v as 'IMAGE' | 'VIDEO', headerMediaUrl: '' })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="IMAGE" className="text-xs">Image header</SelectItem>
              <SelectItem value="VIDEO" className="text-xs">Video header</SelectItem>
            </SelectContent>
          </Select>
          <MediaUploadField format={card.headerFormat} value={card.headerMediaUrl} onChange={(url) => onChange({ ...card, headerMediaUrl: url })} />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
      <Textarea rows={2} placeholder="Card body text" className="text-xs" value={card.body} onChange={(e) => onChange({ ...card, body: e.target.value })} />
      {productMode && (
        <Input className="h-8 text-xs" placeholder="Product retailer ID (from catalog)" value={card.productRetailerId} onChange={(e) => onChange({ ...card, productRetailerId: e.target.value })} />
      )}
      <ButtonsEditor buttons={card.buttons} onChange={(b) => onChange({ ...card, buttons: b })} allowedTypes={['QUICK_REPLY', 'URL']} max={2} />
    </div>
  );
}

function previewText(text: string) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, n) => `[Sample ${n}]`);
}

function PreviewBubble({ form }: { form: TemplateFormState }) {
  const showHeader = !CAROUSEL_TYPES.includes(form.templateType) && form.headerFormat !== 'NONE';

  return (
    <div className="rounded-2xl bg-[#e5ddd5] p-4 space-y-3">
      <div className="bg-white rounded-lg shadow-sm p-3 max-w-[280px] space-y-2">
        {showHeader && (
          <div>
            {form.headerFormat === 'TEXT' && (
              <p className="font-bold text-sm">{previewText(form.headerText) || 'Header text'}</p>
            )}
            {form.headerFormat === 'IMAGE' && (
              <div className="h-28 rounded-md bg-muted flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            {form.headerFormat === 'VIDEO' && (
              <div className="h-28 rounded-md bg-muted flex items-center justify-center">
                <Video className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            {form.headerFormat === 'DOCUMENT' && (
              <div className="h-16 rounded-md bg-muted flex items-center gap-2 px-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate">{form.headerMediaUrl || 'document.pdf'}</span>
              </div>
            )}
            {form.headerFormat === 'LOCATION' && (
              <div className="h-28 rounded-md bg-muted flex items-center justify-center">
                <MapPin className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>
        )}

        {form.templateType === 'LIMITED_TIME_OFFER' && (
          <div className="rounded-md bg-orange-50 border border-orange-200 px-2 py-1.5 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span className="text-xs font-medium text-orange-800">{form.limitedTimeOfferText || 'Limited time offer'}</span>
          </div>
        )}

        <p className="text-sm whitespace-pre-wrap">{previewText(form.body) || 'Your message body will appear here'}</p>

        {form.footer.trim() && !CAROUSEL_TYPES.includes(form.templateType) && (
          <p className="text-xs text-muted-foreground">{form.footer}</p>
        )}

        {form.templateType === 'COUPON_CODE' && (
          <PreviewButton icon={Copy} text="Copy code" />
        )}
        {form.templateType === 'CALL_PERMISSION_REQUEST' && (
          <PreviewButton icon={PhoneCall} text="Allow call request" />
        )}
        {form.templateType === 'CATALOG' && (
          <PreviewButton icon={ShoppingBag} text="View catalog" />
        )}
        {form.templateType === 'MULTI_PRODUCT' && (
          <PreviewButton icon={ShoppingBag} text="View items" />
        )}
        {form.templateType === 'SINGLE_PRODUCT' && (
          <PreviewButton icon={ShoppingBag} text="View product" />
        )}
        {form.buttons.filter((b) => b.text.trim()).map((b, i) => (
          <PreviewButton key={i} icon={BUTTON_ICONS[b.type]} text={b.text} />
        ))}
      </div>

      {CAROUSEL_TYPES.includes(form.templateType) && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {form.cards.map((card, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-2 w-40 shrink-0 space-y-1.5">
              <div className="h-20 rounded-md bg-muted flex items-center justify-center">
                {card.headerFormat === 'VIDEO' ? <Video className="w-5 h-5 text-muted-foreground" /> : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
              </div>
              <p className="text-xs whitespace-pre-wrap line-clamp-3">{previewText(card.body) || 'Card body text'}</p>
              {card.buttons.filter((b) => b.text.trim()).map((b, bi) => (
                <PreviewButton key={bi} icon={BUTTON_ICONS[b.type]} text={b.text} small />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewButton({ icon: Icon, text, small }: { icon: any; text: string; small?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 border-t pt-1.5 mt-1.5 text-blue-600 ${small ? 'text-[10px]' : 'text-sm'}`}>
      <Icon className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span className="truncate">{text}</span>
    </div>
  );
}

// ---------------- Main dialog ----------------

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initial?: MessageTemplate | null;
  saving: boolean;
  onSave: (data: { name: string; language: string; category: string; components: TemplateComponent[] }) => void;
}

export function TemplateEditorDialog({ open, onOpenChange, mode, initial, saving, onSave }: TemplateEditorDialogProps) {
  const [form, setForm] = useState<TemplateFormState>(blankTemplateForm());

  useEffect(() => {
    if (!open) return;
    setForm(initial ? parseTemplateToForm(initial) : blankTemplateForm());
  }, [open, initial]);

  useEffect(() => {
    if (CAROUSEL_TYPES.includes(form.templateType) && form.cards.length === 0) {
      setForm((f) => ({ ...f, cards: [blankCard()] }));
    }
  }, [form.templateType, form.cards.length]);

  const set = <K extends keyof TemplateFormState>(key: K, value: TemplateFormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const selectedType = TEMPLATE_TYPES.find((t) => t.value === form.templateType)!;
  const isCarousel = CAROUSEL_TYPES.includes(form.templateType);
  const showHeader = !isCarousel;
  const showFooter = !isCarousel && form.templateType !== 'CATALOG' && form.templateType !== 'MULTI_PRODUCT' && form.templateType !== 'SINGLE_PRODUCT';
  const showButtonsEditor = !NO_EXTRA_BUTTONS_TYPES.includes(form.templateType);
  const buttonTypes: TemplateButton['type'][] = form.templateType === 'CUSTOM'
    ? ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE']
    : ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'];

  const handleSave = () => {
    onSave({
      name: form.name.trim().toLowerCase().replace(/\s+/g, '_'),
      language: form.language,
      category: form.category,
      components: buildComponentsFromForm(form),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit template' : 'Create new template'}</DialogTitle>
          <DialogDescription>Build a WhatsApp message template and preview how it will look.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form column */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template name *</Label>
              <Input placeholder="order_confirmation" value={form.name} onChange={(e) => set('name', e.target.value.toLowerCase().replace(/\s/g, '_'))} />
              <p className="text-xs text-muted-foreground">Lowercase, underscores only</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={form.language} onValueChange={(v) => set('language', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => set('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Marketing Template Type</Label>
              <Select value={form.templateType} onValueChange={(v) => set('templateType', v as TemplateType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{selectedType.description}</p>
            </div>

            {selectedType.needsCatalog && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">This template type references products from a Meta Commerce Catalog connected to your WhatsApp Business Account. Enter the catalog and product IDs from Meta Commerce Manager.</p>
              </div>
            )}

            {showHeader && (
              <div className="space-y-2">
                <Label>Header type</Label>
                <Select value={form.headerFormat} onValueChange={(v) => set('headerFormat', v as TemplateFormState['headerFormat'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="IMAGE">Image</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                    <SelectItem value="DOCUMENT">Document</SelectItem>
                    <SelectItem value="LOCATION">Location</SelectItem>
                  </SelectContent>
                </Select>
                {form.headerFormat === 'TEXT' && (
                  <Input placeholder="Header text (max 60 chars)" maxLength={60} value={form.headerText} onChange={(e) => set('headerText', e.target.value)} />
                )}
                {(form.headerFormat === 'IMAGE' || form.headerFormat === 'VIDEO' || form.headerFormat === 'DOCUMENT') && (
                  <MediaUploadField format={form.headerFormat} value={form.headerMediaUrl} onChange={(url) => set('headerMediaUrl', url)} />
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Body text *</Label>
              <Textarea
                rows={4}
                placeholder="Hello {{1}}, your order {{2}} has been confirmed!"
                value={form.body}
                onChange={(e) => set('body', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Use &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; for variables</p>
            </div>

            {showFooter && (
              <div className="space-y-2">
                <Label>Footer text</Label>
                <Input placeholder="Optional footer (max 60 chars)" maxLength={60} value={form.footer} onChange={(e) => set('footer', e.target.value)} />
              </div>
            )}

            {form.templateType === 'COUPON_CODE' && (
              <div className="space-y-2">
                <Label>Sample coupon code</Label>
                <Input placeholder="SAVE20" value={form.couponCode} onChange={(e) => set('couponCode', e.target.value)} />
                <p className="text-xs text-muted-foreground">A "Copy code" button will be added automatically.</p>
              </div>
            )}

            {form.templateType === 'LIMITED_TIME_OFFER' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Offer text</Label>
                  <Input placeholder="20% off, valid until end of month!" value={form.limitedTimeOfferText} onChange={(e) => set('limitedTimeOfferText', e.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Show expiration countdown</p>
                    <p className="text-xs text-muted-foreground">Displays a countdown timer in the message</p>
                  </div>
                  <Switch checked={form.hasExpiration} onCheckedChange={(v) => set('hasExpiration', v)} />
                </div>
              </div>
            )}

            {form.templateType === 'CATALOG' && (
              <div className="space-y-2">
                <Label>Catalog ID *</Label>
                <Input placeholder="Meta Commerce Catalog ID" value={form.catalogId} onChange={(e) => set('catalogId', e.target.value)} />
              </div>
            )}

            {form.templateType === 'MULTI_PRODUCT' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Catalog ID *</Label>
                  <Input placeholder="Meta Commerce Catalog ID" value={form.catalogId} onChange={(e) => set('catalogId', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Product retailer IDs</Label>
                  <Input placeholder="sku-001, sku-002, sku-003" value={form.productRetailerId} onChange={(e) => set('productRetailerId', e.target.value)} />
                  <p className="text-xs text-muted-foreground">Comma-separated retailer IDs from your catalog</p>
                </div>
              </div>
            )}

            {form.templateType === 'SINGLE_PRODUCT' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Catalog ID *</Label>
                  <Input placeholder="Meta Commerce Catalog ID" value={form.catalogId} onChange={(e) => set('catalogId', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Product retailer ID</Label>
                  <Input placeholder="sku-001" value={form.productRetailerId} onChange={(e) => set('productRetailerId', e.target.value)} />
                </div>
              </div>
            )}

            {isCarousel && (
              <div className="space-y-2">
                <Label>Carousel cards</Label>
                <div className="space-y-3">
                  {form.cards.map((card, i) => (
                    <CardEditor
                      key={i}
                      card={card}
                      productMode={form.templateType === 'PRODUCT_CARD_CAROUSEL'}
                      onChange={(c) => set('cards', form.cards.map((existing, idx) => idx === i ? c : existing))}
                      onRemove={() => set('cards', form.cards.filter((_, idx) => idx !== i))}
                    />
                  ))}
                </div>
                {form.cards.length < 10 && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => set('cards', [...form.cards, blankCard()])}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />Add card
                  </Button>
                )}
              </div>
            )}

            {showButtonsEditor && (
              <div className="space-y-2">
                <Label>Buttons</Label>
                <ButtonsEditor buttons={form.buttons} onChange={(b) => set('buttons', b)} allowedTypes={buttonTypes} max={3} />
              </div>
            )}

            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-xs font-semibold">Template guidelines</p>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                <li>Body text supports up to 1024 characters and numbered variables like &#123;&#123;1&#125;&#125;</li>
                <li>Header and footer text are limited to 60 characters</li>
                <li>Up to 3 buttons total, or 2 per carousel card</li>
              </ul>
            </div>

            {form.category === 'MARKETING' && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800">Marketing templates require Meta approval before they can be sent and may take up to 24 hours to review.</p>
              </div>
            )}
          </div>

          {/* Preview column */}
          <div className="space-y-2">
            <Label>WhatsApp Preview</Label>
            <div className="sticky top-0">
              <PreviewBubble form={form} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !isTemplateFormValid(form)}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            {mode === 'edit' ? 'Save changes' : 'Create template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
