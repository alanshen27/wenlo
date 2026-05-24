import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/blocknote-ui/avatar";
import { Badge } from "@/components/blocknote-ui/badge";
import { Button } from "@/components/blocknote-ui/button";
import { Card, CardContent } from "@/components/blocknote-ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/blocknote-ui/dropdown-menu";
import { Form } from "@/components/blocknote-ui/form";
import { Input } from "@/components/blocknote-ui/input";
import { Label } from "@/components/blocknote-ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/blocknote-ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/blocknote-ui/select";
import { Skeleton } from "@/components/blocknote-ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/blocknote-ui/tabs";
import { Toggle } from "@/components/blocknote-ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/blocknote-ui/tooltip";

export const blocknoteShadCNComponents = {
  Avatar: { Avatar, AvatarFallback, AvatarImage },
  Badge: { Badge },
  Button: { Button },
  Card: { Card, CardContent },
  DropdownMenu: {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
  },
  Form: { Form },
  Input: { Input },
  Label: { Label },
  Popover: { Popover, PopoverContent, PopoverTrigger },
  Select: {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  },
  Skeleton: { Skeleton },
  Tabs: { Tabs, TabsContent, TabsList, TabsTrigger },
  Toggle: { Toggle },
  Tooltip: { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger },
};
