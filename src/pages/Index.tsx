import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

type EventType = 'once' | 'monthly' | 'yearly';

interface Event {
  id: string;
  title: string;
  date: Date;
  type: EventType;
  description?: string;
  notificationEnabled?: boolean;
}

const EventTypeColors = {
  once: 'bg-blue-500',
  monthly: 'bg-purple-500',
  yearly: 'bg-orange-500',
};

const EventTypeLabels = {
  once: 'Разовое',
  monthly: 'Ежемесячное',
  yearly: 'Ежегодное',
};

const API_URL = 'https://functions.poehali.dev/eec12068-9e94-450b-a6da-40abe76d58e0';

const Index = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<EventType | 'all'>('all');
  
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: new Date(),
    type: 'once' as EventType,
    description: '',
    notificationEnabled: true,
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(API_URL);
      const data = await response.json();
      
      const eventsWithDates = data.events.map((event: any) => ({
        ...event,
        date: new Date(event.date),
      }));
      
      setEvents(eventsWithDates);
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error('Ошибка загрузки событий');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!notificationsEnabled) return;

    const checkEvents = () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      events.forEach((event) => {
        if (!event.notificationEnabled) return;

        let shouldNotify = false;

        if (event.type === 'once') {
          const eventDate = new Date(event.date.getFullYear(), event.date.getMonth(), event.date.getDate());
          shouldNotify = eventDate.getTime() === today.getTime();
        } else if (event.type === 'monthly') {
          shouldNotify = event.date.getDate() === now.getDate();
        } else if (event.type === 'yearly') {
          shouldNotify = event.date.getDate() === now.getDate() && event.date.getMonth() === now.getMonth();
        }

        if (shouldNotify) {
          sendNotification(event);
        }
      });
    };

    checkEvents();
    const interval = setInterval(checkEvents, 60000 * 60);

    return () => clearInterval(interval);
  }, [events, notificationsEnabled]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Браузер не поддерживает уведомления');
      return;
    }

    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
      toast.success('Уведомления включены');
      return;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        toast.success('Уведомления включены');
      } else {
        toast.error('Разрешение на уведомления отклонено');
      }
    } else {
      toast.error('Уведомления заблокированы в настройках браузера');
    }
  };

  const sendNotification = (event: Event) => {
    if (Notification.permission === 'granted') {
      new Notification('Напоминание о событии', {
        body: `${event.title}${event.description ? ': ' + event.description : ''}`,
        icon: '/favicon.svg',
        tag: event.id,
      });
    }
  };

  const handleAddEvent = async () => {
    if (!newEvent.title.trim()) {
      toast.error('Введите название события');
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newEvent.title,
          date: newEvent.date.toISOString().split('T')[0],
          type: newEvent.type,
          description: newEvent.description,
          notificationEnabled: newEvent.notificationEnabled,
        }),
      });

      if (!response.ok) throw new Error('Failed to create event');

      const createdEvent = await response.json();
      setEvents([...events, { ...createdEvent, date: new Date(createdEvent.date) }]);
      
      setNewEvent({
        title: '',
        date: new Date(),
        type: 'once',
        description: '',
        notificationEnabled: true,
      });
      setIsDialogOpen(false);
      toast.success('Событие добавлено');
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Ошибка создания события');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete event');

      setEvents(events.filter((e) => e.id !== id));
      toast.success('Событие удалено');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Ошибка удаления события');
    }
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      if (event.type === 'once') {
        return event.date.toDateString() === date.toDateString();
      }
      if (event.type === 'monthly') {
        return event.date.getDate() === date.getDate();
      }
      if (event.type === 'yearly') {
        return event.date.getDate() === date.getDate() && event.date.getMonth() === date.getMonth();
      }
      return false;
    });
  };

  const filteredEvents = filterType === 'all' 
    ? events 
    : events.filter(e => e.type === filterType);

  const sortedEvents = [...filteredEvents].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
            Напоминатель событий
          </h1>
          <p className="text-muted-foreground text-lg">
            Управляйте своими событиями легко и просто
          </p>
          <div className="mt-4">
            {notificationPermission !== 'granted' ? (
              <Button onClick={requestNotificationPermission} variant="outline" className="gap-2">
                <Icon name="Bell" size={18} />
                Включить уведомления
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon name="BellRing" size={18} className="text-primary" />
                <span>Уведомления активны</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <Card className="p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Icon name="Calendar" size={28} />
                Календарь
              </h2>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Icon name="Plus" size={18} />
                    Добавить
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Новое событие</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="title">Название</Label>
                      <Input
                        id="title"
                        placeholder="Введите название события"
                        value={newEvent.title}
                        onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="type">Тип события</Label>
                      <Select
                        value={newEvent.type}
                        onValueChange={(value: EventType) => setNewEvent({ ...newEvent, type: value })}
                      >
                        <SelectTrigger id="type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="once">Разовое</SelectItem>
                          <SelectItem value="monthly">Ежемесячное</SelectItem>
                          <SelectItem value="yearly">Ежегодное</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Дата</Label>
                      <CalendarComponent
                        mode="single"
                        selected={newEvent.date}
                        onSelect={(date) => date && setNewEvent({ ...newEvent, date })}
                        className="rounded-md border"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Описание</Label>
                      <Input
                        id="description"
                        placeholder="Дополнительная информация"
                        value={newEvent.description}
                        onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleAddEvent} className="w-full">
                      Создать событие
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border-0"
              modifiers={{
                hasEvent: (date) => getEventsForDate(date).length > 0,
              }}
              modifiersStyles={{
                hasEvent: {
                  fontWeight: 'bold',
                  textDecoration: 'underline',
                  color: 'hsl(var(--primary))',
                },
              }}
            />
          </Card>

          <Card className="p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Icon name="ListChecks" size={28} />
                События
              </h2>
              <div className="text-sm text-muted-foreground">
                Всего: {filteredEvents.length}
              </div>
            </div>

            <Tabs defaultValue="all" value={filterType} onValueChange={(v) => setFilterType(v as any)}>
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="all">Все</TabsTrigger>
                <TabsTrigger value="once">Разовые</TabsTrigger>
                <TabsTrigger value="monthly">Месячные</TabsTrigger>
                <TabsTrigger value="yearly">Годовые</TabsTrigger>
              </TabsList>

              <TabsContent value={filterType} className="space-y-3 max-h-[500px] overflow-y-auto">
                {sortedEvents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Icon name="CalendarOff" size={48} className="mx-auto mb-3 opacity-50" />
                    <p>Нет событий</p>
                  </div>
                ) : (
                  sortedEvents.map((event) => (
                    <Card
                      key={event.id}
                      className="p-4 hover:shadow-md transition-all duration-200 border-l-4"
                      style={{ borderLeftColor: `hsl(var(--primary))` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{event.title}</h3>
                            <Badge
                              variant="secondary"
                              className={`${EventTypeColors[event.type]} text-white`}
                            >
                              {EventTypeLabels[event.type]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Icon name="CalendarDays" size={16} />
                            <span>
                              {event.date.toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: event.type === 'once' ? 'numeric' : undefined,
                              })}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground">{event.description}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEvent(event.id)}
                          className="hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Icon name="Trash2" size={18} />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <Card className="p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Icon name="Info" size={28} />
            Типы событий
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50">
              <div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5"></div>
              <div>
                <h3 className="font-semibold mb-1">Разовые события</h3>
                <p className="text-sm text-muted-foreground">
                  Происходят один раз в конкретную дату
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-purple-50">
              <div className="w-3 h-3 rounded-full bg-purple-500 mt-1.5"></div>
              <div>
                <h3 className="font-semibold mb-1">Ежемесячные события</h3>
                <p className="text-sm text-muted-foreground">
                  Повторяются каждый месяц в указанную дату
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-orange-50">
              <div className="w-3 h-3 rounded-full bg-orange-500 mt-1.5"></div>
              <div>
                <h3 className="font-semibold mb-1">Ежегодные события</h3>
                <p className="text-sm text-muted-foreground">
                  Повторяются каждый год в указанную дату
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Index;