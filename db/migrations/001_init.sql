create table if not exists bulb_fitment (
  id                bigint primary key,
  brand             text not null,
  model_name        text not null,
  model_type_name   text,
  model_year        int not null,
  body_type         text,
  type_axles        text,
  model_from        date,
  model_to          date,
  model_kw          int,
  model_tonnage     numeric,
  position_category text,
  position          text,
  technology        text,
  bulb_type         text
);